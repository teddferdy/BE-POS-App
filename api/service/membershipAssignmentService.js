'use strict'

/**
 * T-03A — single authoritative service for tenant-membership and
 * store-assignment mutations (locked Q1–Q17 contract + remediation D1–D16).
 *
 * This module is the ONLY production path that may write
 * `tenant_membership` / `store_assignment` rows. Every mutation:
 *
 *   1. takes actor authority from an explicit `actor` context built by the
 *      caller from the server-resolved canonical auth context
 *      (`resolveAuthorizationContext`), never from request payload, token
 *      claims, or legacy request-user role/store fields;
 *   2. checks, in order (D14): actor capability → input validation →
 *      self-action and target scope visibility (neither reveals anything) →
 *      existence-sensitive lookups → persisted-target authority →
 *      mutation. For scoped actors a
 *      nonexistent target and an out-of-scope target are indistinguishable
 *      (`RESOURCE_NOT_FOUND`);
 *   3. runs inside ONE Sequelize transaction: lock → validate → mutate →
 *      `recordAudit` → session revocation, then COMMIT;
 *   4. performs socket disconnects only AFTER commit (revocation stays
 *      authoritative; a rolled-back transaction never reaches sockets).
 *
 * Canonical semantics implemented here:
 * - Membership lifecycle ACTIVE ↔ DEACTIVATED, → RETIRED (terminal).
 *   Only ACTIVE authorizes. Role lives on membership and never changes on
 *   reactivation (DR-03 Q7/Q14): a mismatched role is a conflict.
 * - Authority is decided on the target's PERSISTED membership role:
 *   tenant_admin manages only roles below tenant_admin (D1); assignment
 *   actors manage only targets ranked below themselves (D6). Actors never
 *   mutate their own membership or assignments (D2).
 * - Assignment has no status: grant = create, revoke = hard delete.
 * - Idempotency: existing/desired state → success no-op without audit (D9);
 *   races arbitrated by row locks and the DB unique constraints
 *   (`UNIQUE(userId,tenantId)`, `UNIQUE(userId,storeId)`), never removed.
 * - Reductions revoke only the sessions whose authority came from the
 *   reduced membership/assignment (D5-B); a platform_admin membership
 *   confers global capability, so its reduction revokes every session.
 *   Grants and upgrades rely on per-request re-resolution.
 * - `version` on the session row is NEVER an invalidation mechanism.
 * - Results carry only the mutated resource, outcome flags, audit ids,
 *   requestId and a revoked-session count (D7) — never resolved scope or
 *   session identifiers.
 *
 * Errors are `Error` objects carrying `.code` / `.field` (canonical
 * `{code, field, message}` shape) so a future HTTP layer can map them
 * without parsing messages. No HTTP, no routes, no FE in this module.
 */

const crypto = require('crypto')
const db = require('../../db/models')
const { TARGET_ROLES, resolveAuthorizationContext } = require('../../utils/authContext')
const { recordAudit } = require('../../utils/auditLog')
const { revokeAllUserSessions, revokeContextSession } = require('../../utils/authorizationContextMiddleware')
const locks = require('../../utils/membershipLocks')
const { disconnectUser, disconnectSession } = require('./socket')

const { Op } = db.Sequelize

// Canonical privilege rank (higher = more privilege). Used for the Q8
// grant ceiling, the D1/D6 persisted-target ceilings, and
// downgrade-vs-upgrade detection on role change.
const ROLE_RANK = Object.freeze({
  staff: 0,
  cashier: 1,
  store_admin: 2,
  tenant_admin: 3,
  platform_admin: 4
})

const ACTIVE = 'ACTIVE'
const DEACTIVATED = 'DEACTIVATED'
const RETIRED = 'RETIRED'

// Explicit transition table (Q1). Empty set = terminal.
const MEMBERSHIP_TRANSITIONS = Object.freeze({
  [ACTIVE]: Object.freeze([DEACTIVATED, RETIRED]),
  [DEACTIVATED]: Object.freeze([ACTIVE, RETIRED]),
  [RETIRED]: Object.freeze([])
})

// Canonical roles ranked strictly below `role` (unknown roles → none).
const rolesBelow = (role) => TARGET_ROLES.filter((r) => ROLE_RANK[r] < ROLE_RANK[role])

// Q8 grant ceiling — the single source for mutation-time authorization AND
// the T-03B available-roles UX metadata: platform_admin grants every
// canonical role; tenant_admin only roles strictly below tenant_admin;
// nobody else grants membership roles.
const grantableRoles = (actorRole) => {
  if (actorRole === 'platform_admin') return [...TARGET_ROLES]
  if (actorRole === 'tenant_admin') return rolesBelow('tenant_admin')
  return []
}

const MEMBERSHIP_ADMIN_ROLES = Object.freeze(['platform_admin', 'tenant_admin'])
const ASSIGNMENT_ADMIN_ROLES = Object.freeze(['platform_admin', 'tenant_admin', 'store_admin'])

const AUDIT_SOURCE = 't03-lifecycle'
const REASON_MAX_LENGTH = 500
// auditLog.requestId is STRING(64): validated here so it can never surface
// as a raw database error.
const REQUEST_ID_MAX_LENGTH = 64
// A lost unique race aborts the Postgres transaction; the whole unit is
// retried once and the retry observes the committed winner under its locks.
const MAX_ATTEMPTS = 2

const fail = (code, field, message) => {
  const err = new Error(message)
  err.code = code
  err.field = field
  return err
}

// One message per field so a scoped caller cannot tell "does not exist"
// from "exists outside your scope" (D14).
const notFound = (field) => fail('RESOURCE_NOT_FOUND', field, `${field} not found`)

const roleConflict = () =>
  fail('ASSIGNMENT_CONFLICT', 'role', 'membership exists with a different role; use changeMembershipRole')

const toId = (value, code, field, label) => {
  let id = null
  if (typeof value === 'number') id = Number.isInteger(value) && value > 0 ? value : null
  else if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const n = Number(value)
    id = Number.isSafeInteger(n) ? n : null
  }
  if (id == null) throw fail(code, field, `${label} must reference an existing record`)
  return id
}

const cleanText = (value) => {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

// D15: trimmed; required for reductions/moves, optional otherwise; always
// length-checked when present.
const normalizeReason = (reason, { required }) => {
  const text = cleanText(reason)
  if (text == null) {
    if (required) throw fail('INVALID_REASON', 'reason', 'a non-empty reason is required for this operation')
    return null
  }
  if (text.length > REASON_MAX_LENGTH) {
    throw fail('INVALID_REASON', 'reason', `reason must be at most ${REASON_MAX_LENGTH} characters`)
  }
  return text
}

const normalizeRequestId = (requestId) => {
  const text = cleanText(requestId)
  if (text == null) return crypto.randomUUID()
  if (text.length > REQUEST_ID_MAX_LENGTH) {
    throw fail('INVALID_REQUEST_ID', 'requestId', `requestId must be at most ${REQUEST_ID_MAX_LENGTH} characters`)
  }
  return text
}

// Actor trust boundary: the caller (future T-03B HTTP layer) builds this
// from `req.authContext`, which canonical authentication + the resolver
// derived from persisted state. Account eligibility (disabled/deleted) is
// enforced by that HTTP boundary before this service is reachable; the
// service additionally requires a well-formed canonical role so a malformed
// context can never authorize.
const requireActor = (actor) => {
  const act = actor && typeof actor === 'object' ? actor : {}
  const userId = toId(act.userId, 'FORBIDDEN', 'actor', 'actor')
  if (!TARGET_ROLES.includes(act.role)) throw fail('FORBIDDEN', 'actor', 'actor has no canonical role')
  return {
    userId,
    role: act.role,
    tenantId: act.tenantId != null ? toId(act.tenantId, 'FORBIDDEN', 'actor', 'actor tenant') : null,
    storeId: act.storeId != null ? toId(act.storeId, 'FORBIDDEN', 'actor', 'actor store') : null
  }
}

const assertCapability = (act, roles, message) => {
  if (!roles.includes(act.role)) throw fail('FORBIDDEN', 'actor', message)
}

// D2: no actor mutates their own membership or assignments. The actor
// already knows their own id, so this reveals nothing.
const assertNotSelf = (act, targetUserId) => {
  if (act.userId === targetUserId) {
    throw fail('FORBIDDEN', 'targetUserId', 'actors may not mutate their own membership or assignments')
  }
}

const validateRole = (role) => {
  if (!TARGET_ROLES.includes(role)) throw fail('INVALID_ROLE', 'role', `role must be one of ${TARGET_ROLES.join(', ')}`)
  return role
}

// Q8 + D14, before any lookup: tenant_admin sees only its own tenant (a
// foreign tenant is indistinguishable from a missing one) and may request
// only roles strictly below tenant_admin.
const assertMembershipScope = (act, tenantId, requestedRole) => {
  if (act.role === 'platform_admin') return
  if (act.tenantId == null || act.tenantId !== tenantId) throw notFound('tenantId')
  if (requestedRole != null && !grantableRoles(act.role).includes(requestedRole)) {
    throw fail('ROLE_CEILING', 'role', 'tenant_admin may not grant tenant_admin or platform_admin')
  }
}

// D1: authority over an existing membership is decided on its PERSISTED
// role. Unknown persisted roles fail closed.
const assertMembershipTarget = (act, membership) => {
  if (act.role === 'platform_admin') return
  if (!(ROLE_RANK[membership.role] < ROLE_RANK.tenant_admin)) {
    throw fail('ROLE_CEILING', 'targetUserId', 'tenant_admin may only manage memberships below tenant_admin')
  }
}

// D14: store visibility. store_admin sees only the stores it is persistently
// assigned to in its active tenant; tenant_admin only stores of its tenant.
// Missing, foreign and tenant-less stores are indistinguishable for scoped
// actors.
//
// T-03B: a store_admin's authority is its persisted assignment scope, not the
// session's selected store — `act.storeId` is context only. The lookup is
// keyed on the actor's own assignment row, so it reveals nothing about the
// target; the tenant check below still binds the store to the actor tenant.
const actorAssignedTo = async (act, storeId) =>
  (await db.storeAssignment.findOne({
    where: { userId: act.userId, storeId, tenantId: act.tenantId },
    attributes: ['id']
  })) != null

const loadVisibleStore = async (act, storeId, field) => {
  if (act.role === 'store_admin' && !(await actorAssignedTo(act, storeId))) throw notFound(field)
  const store = await db.location.findByPk(storeId, { attributes: ['id', 'tenantId'] })
  if (act.role === 'platform_admin') {
    if (!store) throw notFound(field)
    if (store.tenantId == null) {
      // The persisted location.tenantId is authoritative: a store with no
      // approved tenant cannot anchor an assignment.
      throw fail('STORE_TENANT_UNRESOLVED', field, 'target store has no approved tenant')
    }
    return store
  }
  if (!store || store.tenantId == null || act.tenantId == null || Number(store.tenantId) !== act.tenantId) {
    throw notFound(field)
  }
  return store
}

// D6: the target's persisted membership role in the store's tenant decides,
// whatever its status (a DEACTIVATED membership keeps its role). For scoped
// actors a user without a membership in their tenant is not visible.
const loadAssignmentTarget = async (act, userId, store) => {
  const membership = await db.tenantMembership.findOne({
    where: { userId, tenantId: store.tenantId },
    attributes: ['id', 'userId', 'tenantId', 'role', 'status']
  })
  if (act.role === 'platform_admin') return membership
  if (!membership) throw notFound('userId')
  if (!(ROLE_RANK[membership.role] < ROLE_RANK[act.role])) {
    throw fail('ROLE_CEILING', 'targetUserId', `${act.role} may only manage assignments of roles below their own`)
  }
  return membership
}

const lockMembership = (userId, tenantId, transaction) =>
  db.tenantMembership.findOne({ where: { userId, tenantId }, transaction, lock: transaction.LOCK.UPDATE })

// D5-B: every operation that can reduce a membership locks the user's WHOLE
// membership set (utils/membershipLocks), ascending tenantId, as its first
// and only membership lock. Two reductions of different memberships of the
// same user therefore serialize, and the later one's sole-effective-
// membership evaluation sees the earlier one's committed result (no write
// skew). Taking the target row first and the rest afterwards would invert
// the order and could deadlock. The session switches take the same lock.
const lockUserMemberships = (userId, transaction) => locks.lockUserMemberships(db, userId, transaction)

// T-03B (DR-03 Q8): a DEACTIVATED → ACTIVE transition stamps reactivatedAt
// from the database clock, the same source as the session's authentication
// instant. Only reactivation sets it — never create, role change or
// assignment changes. The row is reloaded so snapshots/audit carry the value.
const markReactivated = async (row, transaction) => {
  row.status = ACTIVE
  row.reactivatedAt = db.sequelize.fn('NOW')
  await row.save({ transaction })
  await row.reload({ transaction })
}

const lockAssignment = (userId, storeId, transaction) => locks.lockAssignment(db, userId, storeId, transaction)

// Runs `work` as one transaction. Unique races retry the whole unit once,
// then normalize to a conflict; FK violations mean a referenced row
// vanished concurrently. No raw Sequelize error escapes these paths.
const inTransaction = async (work, conflictField) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.sequelize.transaction(work)
    } catch (err) {
      if (err != null && err.name === 'SequelizeUniqueConstraintError') {
        if (attempt < MAX_ATTEMPTS) continue
        throw fail('ASSIGNMENT_CONFLICT', conflictField, 'a concurrent change conflicted; retry the operation')
      }
      if (err != null && err.name === 'SequelizeForeignKeyConstraintError') throw notFound(conflictField)
      throw err
    }
  }
}

// Deep-cloned, JSON-serializable evidence snapshots. A plain
// `row.get({ plain: true })` is not sufficient: it observes the live row,
// so a before-image would reflect later in-transaction mutations.
const snapshot = (row) => {
  if (row == null) return row
  const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row
  return JSON.parse(JSON.stringify(plain))
}

const auditMutation = ({ action, actorUserId, targetUserId, tenantId, storeId, reason, requestId, before, after, entity, entityId, transaction }) =>
  recordAudit({
    actor: { id: actorUserId, type: 'USER' },
    action,
    entity,
    entityId,
    description: `${action}: user ${targetUserId}`,
    tenantId,
    storeId,
    reason,
    previousState: before,
    newState: after,
    requestId,
    result: 'SUCCESS',
    source: AUDIT_SOURCE,
    transaction
  })

const revokeSessionRows = async (userId, sessions, transaction) => {
  const sessionIds = []
  for (const session of sessions) {
    const revoked = await revokeContextSession(db, session.sessionId, userId, { transaction })
    if (revoked) sessionIds.push(session.sessionId)
  }
  return { userId, global: false, sessionIds, count: sessionIds.length }
}

// D5-B: revoke only the sessions whose authority came from this ACTIVE
// membership, enlisted in the caller's transaction. The caller holds the
// user's full membership lock (lockUserMemberships) and calls this BEFORE
// writing any membership change, so the canonical resolver — run inside the
// same transaction — evaluates the pre-mutation state serialized against
// every other reduction of this user:
//   - sessions pinned to the membership's tenant;
//   - tenant-less sessions, when this tenant is the user's sole effective
//     membership (the resolver defaults them to it);
//   - every session when the persisted role is platform_admin (global
//     capability).
// Sessions resolved to any other tenant are never touched (DR-03 Q6).
const revokeMembershipSessions = async (membership, transaction) => {
  const userId = membership.userId
  if (membership.role === 'platform_admin') {
    const count = await revokeAllUserSessions(db, userId, { transaction })
    return { userId, global: true, sessionIds: [], count }
  }
  const tenantId = Number(membership.tenantId)
  const context = await resolveAuthorizationContext(db, { userId, transaction })
  const effective = context.effectiveTenantIds.map(Number)
  const soleEffective = effective.length === 1 && effective[0] === tenantId
  const tenantClause = soleEffective
    ? { [Op.or]: [{ activeTenantId: tenantId }, { activeTenantId: null }] }
    : { activeTenantId: tenantId }
  const sessions = await db.authorizationContextSession.findAll({
    where: { userId, revokedAt: null, ...tenantClause },
    attributes: ['sessionId'],
    transaction
  })
  return revokeSessionRows(userId, sessions, transaction)
}

// Assignment reductions stay store-scoped: only sessions that selected the
// removed store are affected.
const revokeStoreSessions = async (userId, storeId, transaction) => {
  const sessions = await db.authorizationContextSession.findAll({
    where: { userId, activeStoreId: storeId, revokedAt: null },
    attributes: ['sessionId'],
    transaction
  })
  return revokeSessionRows(userId, sessions, transaction)
}

// Sockets only after commit: a rolled-back revocation must never evict.
const disconnectRevoked = (revocation) => {
  if (revocation == null) return
  if (revocation.global) {
    disconnectUser(revocation.userId)
    return
  }
  for (const sessionId of revocation.sessionIds) disconnectSession(sessionId)
}

// D7: strip internal revocation detail; expose only its count.
const publicResult = ({ revocation, ...outcome }, requestId) => ({
  ...outcome,
  revokedSessionCount: revocation ? revocation.count : 0,
  requestId
})

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

async function createMembership({ actor, targetUserId, tenantId, role, reason = null, requestId = null } = {}) {
  const act = requireActor(actor)
  assertCapability(act, MEMBERSHIP_ADMIN_ROLES, 'actor may not mutate membership')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  const cleanRole = validateRole(role)
  const auditReason = normalizeReason(reason, { required: false })
  const rid = normalizeRequestId(requestId)
  assertMembershipScope(act, tid, cleanRole)
  assertNotSelf(act, uid)

  // Audit event identity is `entity.action` (e.g. membership/deactivate):
  // the legacy auditLog.action column holds 20 characters, so the short
  // verb lives in `action` and the domain in `entity`, matching the
  // existing entity/action convention (user/update, role/delete).
  const auditIn = (t, verb, before, after, entityId) =>
    auditMutation({
      action: verb,
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: tid,
      reason: auditReason,
      requestId: rid,
      before,
      after,
      entity: 'membership',
      entityId,
      transaction: t
    })

  const outcome = await inTransaction(async (t) => {
    const row = await lockMembership(uid, tid, t)
    if (!row) {
      // D16: only platform_admin may introduce a previously unrelated user
      // into a tenant. For tenant_admin an absent row is indistinguishable
      // from a nonexistent user.
      if (act.role !== 'platform_admin') throw notFound('userId')
      const user = await db.user.findByPk(uid, { attributes: ['id'], transaction: t })
      if (!user) throw notFound('userId')
      const tenant = await db.tenant.findByPk(tid, { attributes: ['id'], transaction: t })
      if (!tenant) throw notFound('tenantId')
      const created = await db.tenantMembership.create(
        { userId: uid, tenantId: tid, role: cleanRole, status: ACTIVE },
        { transaction: t }
      )
      const auditRow = await auditIn(t, 'create', null, snapshot(created), created.id)
      return { membership: snapshot(created), created: true, reactivated: false, noOp: false, auditId: auditRow.id }
    }
    assertMembershipTarget(act, row)
    if (row.status === RETIRED) {
      throw fail('TRANSITION_FORBIDDEN', 'status', 'retired membership cannot be reactivated')
    }
    // DR-03 Q7/Q14 (D3): reactivation never changes role.
    if (row.role !== cleanRole) throw roleConflict()
    if (row.status === ACTIVE) {
      return { membership: snapshot(row), created: false, reactivated: false, noOp: true, auditId: null }
    }
    const before = snapshot(row)
    await markReactivated(row, t)
    const auditRow = await auditIn(t, 'reactivate', before, snapshot(row), row.id)
    return { membership: snapshot(row), created: false, reactivated: true, noOp: false, auditId: auditRow.id }
  }, 'userId')

  // Grants rely on per-request re-resolution: no session revocation.
  return publicResult(outcome, rid)
}

const reduceMembershipStatus = async ({ actor, targetUserId, tenantId, reason, requestId, toStatus, auditAction }) => {
  const act = requireActor(actor)
  assertCapability(act, MEMBERSHIP_ADMIN_ROLES, 'actor may not mutate membership')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  const auditReason = normalizeReason(reason, { required: true })
  const rid = normalizeRequestId(requestId)
  assertMembershipScope(act, tid, null)
  assertNotSelf(act, uid)

  const outcome = await inTransaction(async (t) => {
    const row = (await lockUserMemberships(uid, t)).get(tid)
    if (!row) throw notFound('userId')
    assertMembershipTarget(act, row)
    if (row.status === toStatus) {
      return { membership: snapshot(row), noOp: true, auditId: null, revocation: null }
    }
    if (!MEMBERSHIP_TRANSITIONS[row.status].includes(toStatus)) {
      throw fail('TRANSITION_FORBIDDEN', 'status', `transition ${row.status} to ${toStatus} is forbidden`)
    }
    // Only an ACTIVE membership confers authority, so only leaving ACTIVE
    // is a privilege reduction (Q10). DEACTIVATED → RETIRED revokes nothing.
    const revocation = row.status === ACTIVE ? await revokeMembershipSessions(row, t) : null
    const before = snapshot(row)
    row.status = toStatus
    await row.save({ transaction: t })
    const auditRow = await auditMutation({
      action: auditAction,
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: tid,
      reason: auditReason,
      requestId: rid,
      before,
      after: snapshot(row),
      entity: 'membership',
      entityId: row.id,
      transaction: t
    })
    return { membership: snapshot(row), noOp: false, auditId: auditRow.id, revocation }
  }, 'userId')

  disconnectRevoked(outcome.revocation)
  return publicResult(outcome, rid)
}

async function deactivateMembership(args = {}) {
  return reduceMembershipStatus({ ...args, toStatus: DEACTIVATED, auditAction: 'deactivate' })
}

async function retireMembership(args = {}) {
  return reduceMembershipStatus({ ...args, toStatus: RETIRED, auditAction: 'retire' })
}

async function reactivateMembership({ actor, targetUserId, tenantId, reason = null, requestId = null } = {}) {
  const act = requireActor(actor)
  assertCapability(act, MEMBERSHIP_ADMIN_ROLES, 'actor may not mutate membership')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  const auditReason = normalizeReason(reason, { required: false })
  const rid = normalizeRequestId(requestId)
  assertMembershipScope(act, tid, null)
  assertNotSelf(act, uid)

  const outcome = await inTransaction(async (t) => {
    const row = await lockMembership(uid, tid, t)
    if (!row) throw notFound('userId')
    // D1/D3: a reactivation restores the persisted role, so it is authorized
    // against that role — never a way to resurrect a privileged membership.
    assertMembershipTarget(act, row)
    if (row.status === ACTIVE) {
      return { membership: snapshot(row), noOp: true, auditId: null }
    }
    if (row.status === RETIRED) {
      throw fail('TRANSITION_FORBIDDEN', 'status', 'retired membership cannot be reactivated')
    }
    const before = snapshot(row)
    await markReactivated(row, t)
    const auditRow = await auditMutation({
      action: 'reactivate',
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: tid,
      reason: auditReason,
      requestId: rid,
      before,
      after: snapshot(row),
      entity: 'membership',
      entityId: row.id,
      transaction: t
    })
    return { membership: snapshot(row), noOp: false, auditId: auditRow.id }
  }, 'userId')

  return publicResult(outcome, rid)
}

async function changeMembershipRole({ actor, targetUserId, tenantId, role, reason, requestId = null } = {}) {
  const act = requireActor(actor)
  assertCapability(act, MEMBERSHIP_ADMIN_ROLES, 'actor may not mutate membership')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  const cleanRole = validateRole(role)
  const auditReason = normalizeReason(reason, { required: true })
  const rid = normalizeRequestId(requestId)
  assertMembershipScope(act, tid, cleanRole)
  assertNotSelf(act, uid)

  const outcome = await inTransaction(async (t) => {
    // Full-set lock even before knowing whether this is a downgrade.
    const row = (await lockUserMemberships(uid, t)).get(tid)
    if (!row) throw notFound('userId')
    // Both ends are ceilinged: the requested role above, the persisted one here.
    assertMembershipTarget(act, row)
    if (row.status !== ACTIVE) {
      // A role change must never silently reactivate a non-ACTIVE row.
      throw fail('TRANSITION_FORBIDDEN', 'status', 'role can only change on an ACTIVE membership')
    }
    if (row.role === cleanRole) {
      return { membership: snapshot(row), noOp: true, auditId: null, downgrade: false, revocation: null }
    }
    const downgrade = ROLE_RANK[cleanRole] < ROLE_RANK[row.role]
    // Evaluated on the pre-change role (a platform_admin downgrade is global).
    const revocation = downgrade ? await revokeMembershipSessions(row, t) : null
    const before = snapshot(row)
    row.role = cleanRole
    await row.save({ transaction: t })
    const auditRow = await auditMutation({
      action: 'role.change',
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: tid,
      reason: auditReason,
      requestId: rid,
      before,
      after: snapshot(row),
      entity: 'membership',
      entityId: row.id,
      transaction: t
    })
    return { membership: snapshot(row), noOp: false, auditId: auditRow.id, downgrade, revocation }
  }, 'userId')

  disconnectRevoked(outcome.revocation)
  return publicResult(outcome, rid)
}

// Platform-only cross-tenant relocation in ONE transaction (D10-B): the
// target becomes ACTIVE (created or reactivated) and the ACTIVE source is
// DEACTIVATED (reversible, never retired, so a return move stays possible
// under the unique constraint). Any failure rolls back both sides.
async function moveMembership({ actor, targetUserId, fromTenantId, toTenantId, role = null, reason, requestId = null } = {}) {
  const act = requireActor(actor)
  assertCapability(act, ['platform_admin'], 'only platform_admin may move membership across tenants')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const fromTid = toId(fromTenantId, 'RESOURCE_NOT_FOUND', 'fromTenantId', 'source tenant')
  const toTid = toId(toTenantId, 'RESOURCE_NOT_FOUND', 'toTenantId', 'target tenant')
  if (fromTid === toTid) {
    throw fail('TRANSITION_FORBIDDEN', 'toTenantId', 'source and target tenants must differ')
  }
  const requestedRole = role == null ? null : validateRole(role)
  const auditReason = normalizeReason(reason, { required: true })
  const rid = normalizeRequestId(requestId)
  assertNotSelf(act, uid)

  const auditIn = (t, verb, tenantId, before, after, entityId) =>
    auditMutation({
      action: verb,
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId,
      reason: auditReason,
      requestId: rid,
      before,
      after,
      entity: 'membership',
      entityId,
      transaction: t
    })

  const outcome = await inTransaction(async (t) => {
    // The user's full membership set, ascending tenantId, covers the source
    // and any existing target in one deterministic lock.
    const locked = await lockUserMemberships(uid, t)
    const source = locked.get(fromTid)
    const target = locked.get(toTid)

    if (!source) throw notFound('fromTenantId')
    if (source.status === RETIRED) throw fail('TRANSITION_FORBIDDEN', 'status', 'retired membership cannot be moved')
    if (target && target.status === RETIRED) throw fail('TRANSITION_FORBIDDEN', 'status', 'target membership is retired')
    // D4: an existing target keeps its persisted role.
    if (target && requestedRole != null && target.role !== requestedRole) throw roleConflict()
    if (source.status !== ACTIVE) {
      // Source already DEACTIVATED with an ACTIVE target: the move is
      // complete (idempotent retry) — no audit, no revocation.
      if (target && target.status === ACTIVE) {
        return {
          source: snapshot(source),
          target: snapshot(target),
          created: false,
          reactivated: false,
          noOp: true,
          auditIds: [],
          revocation: null
        }
      }
      throw fail('TRANSITION_FORBIDDEN', 'status', 'source membership is not active')
    }

    const revocation = await revokeMembershipSessions(source, t)
    const auditIds = []
    let targetRow = target
    let created = false
    let reactivated = false
    if (!targetRow) {
      const tenant = await db.tenant.findByPk(toTid, { attributes: ['id'], transaction: t })
      if (!tenant) throw notFound('toTenantId')
      targetRow = await db.tenantMembership.create(
        { userId: uid, tenantId: toTid, role: requestedRole || source.role, status: ACTIVE },
        { transaction: t }
      )
      auditIds.push((await auditIn(t, 'create', toTid, null, snapshot(targetRow), targetRow.id)).id)
      created = true
    } else if (targetRow.status === DEACTIVATED) {
      const targetBefore = snapshot(targetRow)
      await markReactivated(targetRow, t)
      auditIds.push((await auditIn(t, 'reactivate', toTid, targetBefore, snapshot(targetRow), targetRow.id)).id)
      reactivated = true
    }

    const sourceBefore = snapshot(source)
    source.status = DEACTIVATED
    await source.save({ transaction: t })
    auditIds.push((await auditIn(t, 'deactivate', fromTid, sourceBefore, snapshot(source), source.id)).id)

    return {
      source: snapshot(source),
      target: snapshot(targetRow),
      created,
      reactivated,
      noOp: false,
      auditIds,
      revocation
    }
  }, 'toTenantId')

  disconnectRevoked(outcome.revocation)
  return publicResult(outcome, rid)
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

async function grantAssignment({ actor, targetUserId, storeId, reason = null, requestId = null } = {}) {
  const act = requireActor(actor)
  assertCapability(act, ASSIGNMENT_ADMIN_ROLES, 'actor may not mutate assignments')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const sid = toId(storeId, 'RESOURCE_NOT_FOUND', 'storeId', 'target store')
  const auditReason = normalizeReason(reason, { required: false })
  const rid = normalizeRequestId(requestId)
  assertNotSelf(act, uid)

  const store = await loadVisibleStore(act, sid, 'storeId')
  const membership = await loadAssignmentTarget(act, uid, store)
  if (!membership) {
    // Only platform_admin reaches here (scoped actors got RESOURCE_NOT_FOUND).
    const user = await db.user.findByPk(uid, { attributes: ['id'] })
    if (!user) throw notFound('userId')
  }
  // Default paranoid scope excludes soft-deleted rows; only ACTIVE counts.
  if (!membership || membership.status !== ACTIVE) {
    throw fail('MEMBERSHIP_REQUIRED', 'storeId', 'user has no active membership in the store tenant')
  }

  const outcome = await inTransaction(async (t) => {
    const existing = await lockAssignment(uid, store.id, t)
    if (existing) {
      if (Number(existing.tenantId) !== Number(store.tenantId)) {
        // Stale tenant-inconsistent row (only possible via hook bypass):
        // cannot be normalized into the idempotent contract.
        throw fail('ASSIGNMENT_CONFLICT', 'storeId', 'existing assignment targets a different tenant')
      }
      return { assignment: snapshot(existing), created: false, noOp: true, auditId: null }
    }
    const row = await db.storeAssignment.create(
      { userId: uid, tenantId: store.tenantId, storeId: store.id },
      { transaction: t }
    )
    const auditRow = await auditMutation({
      action: 'grant',
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: store.tenantId,
      storeId: store.id,
      reason: auditReason,
      requestId: rid,
      before: null,
      after: snapshot(row),
      entity: 'assignment',
      entityId: row.id,
      transaction: t
    })
    return { assignment: snapshot(row), created: true, noOp: false, auditId: auditRow.id }
  }, 'storeId')

  return publicResult(outcome, rid)
}

async function revokeAssignment({ actor, targetUserId, storeId, reason, requestId = null } = {}) {
  const act = requireActor(actor)
  assertCapability(act, ASSIGNMENT_ADMIN_ROLES, 'actor may not mutate assignments')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const sid = toId(storeId, 'RESOURCE_NOT_FOUND', 'storeId', 'target store')
  const auditReason = normalizeReason(reason, { required: true })
  const rid = normalizeRequestId(requestId)
  assertNotSelf(act, uid)

  const store = await loadVisibleStore(act, sid, 'storeId')
  await loadAssignmentTarget(act, uid, store)

  const outcome = await inTransaction(async (t) => {
    const row = await lockAssignment(uid, store.id, t)
    if (!row) {
      // Idempotent revoke: the desired end state already holds (D12).
      return { assignment: null, revoked: false, noOp: true, auditId: null, revocation: null }
    }
    const before = snapshot(row)
    await row.destroy({ transaction: t })
    const auditRow = await auditMutation({
      action: 'revoke',
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: store.tenantId,
      storeId: store.id,
      reason: auditReason,
      requestId: rid,
      before,
      after: null,
      entity: 'assignment',
      entityId: before.id,
      transaction: t
    })
    const revocation = await revokeStoreSessions(uid, store.id, t)
    return { assignment: before, revoked: true, noOp: false, auditId: auditRow.id, revocation }
  }, 'storeId')

  disconnectRevoked(outcome.revocation)
  return publicResult(outcome, rid)
}

// Store relocation in one transaction: revoke at fromStoreId and ensure an
// assignment at toStoreId. Authority is required at BOTH ends and the target
// tenant must hold an ACTIVE membership (same rule as grant).
async function moveAssignment({ actor, targetUserId, fromStoreId, toStoreId, reason, requestId = null } = {}) {
  const act = requireActor(actor)
  assertCapability(act, ASSIGNMENT_ADMIN_ROLES, 'actor may not mutate assignments')
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const fromSid = toId(fromStoreId, 'RESOURCE_NOT_FOUND', 'fromStoreId', 'source store')
  const toSid = toId(toStoreId, 'RESOURCE_NOT_FOUND', 'toStoreId', 'target store')
  const auditReason = normalizeReason(reason, { required: true })
  const rid = normalizeRequestId(requestId)
  assertNotSelf(act, uid)

  const fromStore = await loadVisibleStore(act, fromSid, 'fromStoreId')
  const toStore = fromSid === toSid ? fromStore : await loadVisibleStore(act, toSid, 'toStoreId')
  await loadAssignmentTarget(act, uid, fromStore)
  const toMembership = fromSid === toSid ? null : await loadAssignmentTarget(act, uid, toStore)
  if (fromSid === toSid) {
    return publicResult({ assignment: null, moved: false, created: false, noOp: true, auditIds: [], revocation: null }, rid)
  }
  if (!toMembership || toMembership.status !== ACTIVE) {
    throw fail('MEMBERSHIP_REQUIRED', 'toStoreId', 'user has no active membership in the target store tenant')
  }

  const moveIn = (t, verb, store, before, after, entityId) =>
    auditMutation({
      action: verb,
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: store.tenantId,
      storeId: store.id,
      reason: auditReason,
      requestId: rid,
      before,
      after,
      entity: 'assignment',
      entityId,
      transaction: t
    })

  const outcome = await inTransaction(async (t) => {
    // D12: both rows locked in ascending storeId order; every decision below
    // comes from this locked state, so a concurrent destination revoke can
    // no longer make the move skip the create and lose both assignments.
    const locked = new Map()
    for (const storeId of [fromSid, toSid].sort((a, b) => a - b)) {
      locked.set(storeId, await lockAssignment(uid, storeId, t))
    }
    const source = locked.get(fromSid)
    const destination = locked.get(toSid)

    if (destination && Number(destination.tenantId) !== Number(toStore.tenantId)) {
      throw fail('ASSIGNMENT_CONFLICT', 'toStoreId', 'existing assignment targets a different tenant')
    }
    if (!source) {
      // Already at the destination and gone from the source: the move is
      // complete (idempotent retry) — no audit, no revocation.
      if (destination) {
        return { assignment: snapshot(destination), moved: false, created: false, noOp: true, auditIds: [], revocation: null }
      }
      throw notFound('fromStoreId')
    }

    const auditIds = []
    const sourceBefore = snapshot(source)
    await source.destroy({ transaction: t })
    auditIds.push((await moveIn(t, 'revoke', fromStore, sourceBefore, null, sourceBefore.id)).id)

    let assignment = snapshot(destination)
    let created = false
    if (!destination) {
      const row = await db.storeAssignment.create(
        { userId: uid, tenantId: toStore.tenantId, storeId: toStore.id },
        { transaction: t }
      )
      auditIds.push((await moveIn(t, 'grant', toStore, null, snapshot(row), row.id)).id)
      assignment = snapshot(row)
      created = true
    }

    const revocation = await revokeStoreSessions(uid, fromSid, t)
    return { assignment, moved: true, created, noOp: false, auditIds, revocation }
  }, 'toStoreId')

  disconnectRevoked(outcome.revocation)
  return publicResult(outcome, rid)
}

module.exports = {
  ROLE_RANK,
  MEMBERSHIP_TRANSITIONS,
  // T-03B: shared ceiling/visibility helpers and the canonical error shapes
  // the HTTP layer reuses (one source; never re-derived per route).
  grantableRoles,
  rolesBelow,
  toId,
  notFound,
  fail,
  createMembership,
  deactivateMembership,
  reactivateMembership,
  retireMembership,
  changeMembershipRole,
  moveMembership,
  grantAssignment,
  revokeAssignment,
  moveAssignment
}
