'use strict'

/**
 * T-03A — single authoritative service for tenant-membership and
 * store-assignment mutations (locked Q1–Q17 contract).
 *
 * This module is the ONLY production path that may write
 * `tenant_membership` / `store_assignment` rows. Every mutation:
 *
 *   1. takes actor authority from an explicit `actor` context built by the
 *      caller from the server-resolved canonical auth context
 *      (`resolveAuthorizationContext`), never from request payload, token
 *      claims, or legacy request-user role/store fields;
 *   2. resolves target scope (actor tenant/store, membership tenant, store
 *      tenant) from persisted DB rows, never client input;
 *   3. runs inside one Sequelize transaction: validate → lock → mutate →
 *      `recordAudit` → session revocation, then COMMIT;
 *   4. performs socket disconnects only AFTER commit (revocation stays
 *      authoritative; a rolled-back transaction never reaches sockets —
 *      same pattern as `changeUserStatusById` / `resetPassword`).
 *
 * Canonical semantics implemented here:
 * - Membership lifecycle ACTIVE ↔ DEACTIVATED, → RETIRED (terminal).
 *   Only ACTIVE authorizes. Role lives on membership.
 * - Assignment has no status: grant = create, revoke = hard delete.
 * - Idempotency: active/existing → success no-op; DEACTIVATED → reactivate
 *   on create; RETIRED → TRANSITION_FORBIDDEN; races arbitrated by the DB
 *   unique constraints (`UNIQUE(userId,tenantId)`,
 *   `UNIQUE(userId,storeId)`), never removed or weakened.
 * - Reductions (deactivate/retire/downgrade/move/revoke) revoke affected
 *   sessions in-transaction and disconnect sockets post-commit. Grants and
 *   upgrades rely on per-request re-resolution and revoke nothing.
 * - `version` on the session row is NEVER an invalidation mechanism.
 *
 * Errors are `Error` objects carrying `.code` / `.field` (canonical
 * `{code, field, message}` shape) so a future HTTP layer can map them
 * without parsing messages. No HTTP, no routes, no FE in this module.
 */

const crypto = require('crypto')
const db = require('../../db/models')
const { TARGET_ROLES, MEMBERSHIP_STATUS, resolveAuthorizationContext } = require('../../utils/authContext')
const { recordAudit } = require('../../utils/auditLog')
const { revokeAllUserSessions, revokeContextSession } = require('../../utils/authorizationContextMiddleware')
const { disconnectUser, disconnectSession } = require('./socket')

// Canonical privilege rank (higher = more privilege). Used for the Q8
// grant ceiling (tenant_admin may only grant strictly below tenant_admin)
// and for downgrade-vs-upgrade detection on role change.
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

const AUDIT_SOURCE = 't03-lifecycle'

const fail = (code, field, message) => {
  const err = new Error(message)
  err.code = code
  err.field = field
  return err
}

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

const cleanReason = (reason) => {
  if (reason == null) return null
  const text = String(reason).trim()
  return text || null
}

const requireReason = (reason) => {
  const text = cleanReason(reason)
  if (text == null) throw fail('INVALID_REASON', 'reason', 'a non-empty reason is required for this operation')
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

const validateRole = (role) => {
  if (!TARGET_ROLES.includes(role)) throw fail('INVALID_ROLE', 'role', `role must be one of ${TARGET_ROLES.join(', ')}`)
  return role
}

// Q8 membership authority. platform_admin: anything. tenant_admin: own
// tenant only, granted role strictly below tenant_admin. Anything else:
// cross-tenant tenant_admin → FOREIGN_TENANT, otherwise FORBIDDEN.
const assertMembershipAuthority = (actor, tenantId, grantedRole) => {
  if (actor.role === 'platform_admin') return
  if (actor.role === 'tenant_admin') {
    if (actor.tenantId == null || Number(actor.tenantId) !== Number(tenantId)) {
      throw fail('FOREIGN_TENANT', 'tenantId', 'tenant_admin may not mutate another tenant')
    }
    if (grantedRole != null && ROLE_RANK[grantedRole] >= ROLE_RANK.tenant_admin) {
      throw fail('ROLE_CEILING', 'role', 'tenant_admin may not grant tenant_admin or platform_admin')
    }
    return
  }
  throw fail('FORBIDDEN', 'actor', 'actor may not mutate membership')
}

// Q9 assignment authority. platform_admin: anything. tenant_admin: stores
// in own tenant. store_admin: own (selected) store only. Anything else:
// tenant_admin off-tenant → FOREIGN_TENANT, store_admin off-store →
// FOREIGN_STORE, otherwise FORBIDDEN.
const assertAssignmentAuthority = (actor, storeTenantId, storeId) => {
  if (actor.role === 'platform_admin') return
  if (actor.role === 'tenant_admin') {
    if (actor.tenantId == null || Number(actor.tenantId) !== Number(storeTenantId)) {
      throw fail('FOREIGN_TENANT', 'storeId', 'tenant_admin may not assign stores of another tenant')
    }
    return
  }
  if (actor.role === 'store_admin') {
    if (actor.storeId == null || Number(actor.storeId) !== Number(storeId)) {
      throw fail('FOREIGN_STORE', 'storeId', 'store_admin may only assign their own store')
    }
    return
  }
  throw fail('FORBIDDEN', 'actor', 'actor may not mutate assignments')
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

const postMutationScope = (userId) => resolveAuthorizationContext(db, { userId })

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

async function createMembership({ actor, targetUserId, tenantId, role, reason = null, requestId = null } = {}) {
  const act = requireActor(actor)
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  const cleanRole = validateRole(role)
  assertMembershipAuthority(act, tid, cleanRole)
  const rid = cleanReason(requestId) || crypto.randomUUID()
  const auditReason = cleanReason(reason)

  const user = await db.user.findByPk(uid, { attributes: ['id'] })
  if (!user) throw fail('RESOURCE_NOT_FOUND', 'userId', 'target user does not exist')
  const tenant = await db.tenant.findByPk(tid, { attributes: ['id'] })
  if (!tenant) throw fail('RESOURCE_NOT_FOUND', 'tenantId', 'target tenant does not exist')

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

  let outcome
  try {
    outcome = await db.sequelize.transaction(async (t) => {
      const row = await db.tenantMembership.create(
        { userId: uid, tenantId: tid, role: cleanRole, status: ACTIVE },
        { transaction: t }
      )
      const auditRow = await auditIn(t, 'create', null, snapshot(row), row.id)
      return { membership: snapshot(row), created: true, reactivated: false, noOp: false, auditId: auditRow.id }
    })
  } catch (err) {
    // Concurrency arbiter: the DB unique constraint decides. A lost race
    // aborts the Postgres transaction, so normalization re-reads committed
    // state OUTSIDE the rolled-back transaction instead of a raw 500.
    if (err == null || err.name !== 'SequelizeUniqueConstraintError') throw err
    const row = await db.tenantMembership.findOne({ where: { userId: uid, tenantId: tid } })
    if (!row) throw err
    if (row.status === ACTIVE) {
      return {
        membership: snapshot(row),
        created: false,
        reactivated: false,
        noOp: true,
        auditId: null,
        scope: await postMutationScope(uid),
        requestId: rid
      }
    }
    if (row.status === DEACTIVATED) {
      const reactivated = await db.sequelize.transaction(async (t) => {
        const locked = await db.tenantMembership.findOne({
          where: { userId: uid, tenantId: tid },
          transaction: t,
          lock: t.LOCK.UPDATE
        })
        if (!locked || locked.status !== DEACTIVATED) {
          throw fail('ASSIGNMENT_CONFLICT', 'status', 'membership changed during reactivation')
        }
        const before = snapshot(locked)
        locked.status = ACTIVE
        await locked.save({ transaction: t })
        const auditRow = await auditIn(t, 'reactivate', before, snapshot(locked), locked.id)
        return { membership: snapshot(locked), auditId: auditRow.id }
      })
      return {
        ...reactivated,
        created: false,
        reactivated: true,
        noOp: false,
        scope: await postMutationScope(uid),
        requestId: rid
      }
    }
    throw fail('TRANSITION_FORBIDDEN', 'status', 'retired membership cannot be reactivated')
  }

  // Grants rely on per-request re-resolution: no session revocation.
  const scope = await postMutationScope(uid)
  return { ...outcome, scope, requestId: rid }
}

const flipMembershipStatus = async ({ actor, targetUserId, tenantId, toStatus, reason, requestId, auditAction, revokeSessions }) => {
  const act = requireActor(actor)
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  assertMembershipAuthority(act, tid, null)
  const auditReason = requireReason(reason)
  const rid = cleanReason(requestId) || crypto.randomUUID()

  const outcome = await db.sequelize.transaction(async (t) => {
    const row = await db.tenantMembership.findOne({
      where: { userId: uid, tenantId: tid },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (!row) throw fail('RESOURCE_NOT_FOUND', 'tenantId', 'membership does not exist')
    if (row.status === toStatus) {
      return { membership: snapshot(row), noOp: true, auditId: null }
    }
    if (!MEMBERSHIP_TRANSITIONS[row.status].includes(toStatus)) {
      throw fail('TRANSITION_FORBIDDEN', 'status', `transition ${row.status} to ${toStatus} is forbidden`)
    }
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
    let revokedSessions = 0
    if (revokeSessions) {
      // Enlisted in the same transaction (proven pattern): a rolled-back
      // status flip never revokes.
      revokedSessions = await revokeAllUserSessions(db, uid, { transaction: t })
    }
    return { membership: snapshot(row), noOp: false, auditId: auditRow.id, revokedSessions }
  })

  if (!outcome.noOp && revokeSessions) {
    // Sockets only after commit: a rolled-back revocation must never evict.
    disconnectUser(uid)
  }
  const scope = await postMutationScope(uid)
  return { ...outcome, scope, requestId: rid }
}

async function deactivateMembership(args = {}) {
  return flipMembershipStatus({ ...args, toStatus: DEACTIVATED, auditAction: 'deactivate', revokeSessions: true })
}

async function reactivateMembership({ actor, targetUserId, tenantId, reason = null, requestId = null } = {}) {
  const act = requireActor(actor)
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  assertMembershipAuthority(act, tid, null)
  const rid = cleanReason(requestId) || crypto.randomUUID()

  const outcome = await db.sequelize.transaction(async (t) => {
    const row = await db.tenantMembership.findOne({
      where: { userId: uid, tenantId: tid },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (!row) throw fail('RESOURCE_NOT_FOUND', 'tenantId', 'membership does not exist')
    if (row.status === ACTIVE) {
      return { membership: snapshot(row), noOp: true, auditId: null }
    }
    if (row.status === RETIRED) {
      throw fail('TRANSITION_FORBIDDEN', 'status', 'retired membership cannot be reactivated')
    }
    const before = snapshot(row)
    row.status = ACTIVE
    await row.save({ transaction: t })
    const auditRow = await auditMutation({
      action: 'reactivate',
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: tid,
      reason: cleanReason(reason),
      requestId: rid,
      before,
      after: snapshot(row),
      entity: 'membership',
      entityId: row.id,
      transaction: t
    })
    return { membership: snapshot(row), noOp: false, auditId: auditRow.id }
  })

  const scope = await postMutationScope(uid)
  return { ...outcome, scope, requestId: rid }
}

async function retireMembership(args = {}) {
  return flipMembershipStatus({ ...args, toStatus: RETIRED, auditAction: 'retire', revokeSessions: true })
}

async function changeMembershipRole({ actor, targetUserId, tenantId, role, reason, requestId = null } = {}) {
  const act = requireActor(actor)
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const tid = toId(tenantId, 'RESOURCE_NOT_FOUND', 'tenantId', 'target tenant')
  const cleanRole = validateRole(role)
  assertMembershipAuthority(act, tid, cleanRole)
  const auditReason = requireReason(reason)
  const rid = cleanReason(requestId) || crypto.randomUUID()

  const outcome = await db.sequelize.transaction(async (t) => {
    const row = await db.tenantMembership.findOne({
      where: { userId: uid, tenantId: tid },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (!row) throw fail('RESOURCE_NOT_FOUND', 'tenantId', 'membership does not exist')
    if (row.status !== ACTIVE) {
      // A role change must never silently reactivate a non-ACTIVE row.
      throw fail('TRANSITION_FORBIDDEN', 'status', 'role can only change on an ACTIVE membership')
    }
    if (row.role === cleanRole) {
      return { membership: snapshot(row), noOp: true, auditId: null, downgrade: false }
    }
    const before = snapshot(row)
    const downgrade = ROLE_RANK[cleanRole] < ROLE_RANK[row.role]
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
    let revokedSessions = 0
    if (downgrade) {
      revokedSessions = await revokeAllUserSessions(db, uid, { transaction: t })
    }
    return { membership: snapshot(row), noOp: false, auditId: auditRow.id, downgrade, revokedSessions }
  })

  if (!outcome.noOp && outcome.downgrade) {
    disconnectUser(uid)
  }
  const scope = await postMutationScope(uid)
  return { ...outcome, scope, requestId: rid }
}

// Platform-only cross-tenant relocation: deactivate in the source tenant
// and create-or-reactivate in the target tenant, atomically. The source row
// is DEACTIVATED (reversible), never retired, so a return relocation stays
// possible under the unique constraint.
async function moveMembership({ actor, targetUserId, fromTenantId, toTenantId, role = null, reason, requestId = null } = {}) {
  const act = requireActor(actor)
  if (act.role !== 'platform_admin') {
    throw fail('FORBIDDEN', 'actor', 'only platform_admin may move membership across tenants')
  }
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const fromTid = toId(fromTenantId, 'RESOURCE_NOT_FOUND', 'fromTenantId', 'source tenant')
  const toTid = toId(toTenantId, 'RESOURCE_NOT_FOUND', 'toTenantId', 'target tenant')
  if (Number(fromTid) === Number(toTid)) {
    throw fail('TRANSITION_FORBIDDEN', 'toTenantId', 'source and target tenants must differ')
  }
  const auditReason = requireReason(reason)
  const rid = cleanReason(requestId) || crypto.randomUUID()

  // Two ordered transactions (target first, source second): each leg is
  // independently atomic, and any failure before the source leg leaves the
  // source untouched. A failure between legs leaves both memberships ACTIVE,
  // which is a safe retryable state under the multi-membership model.
  const targetOutcome = await db.sequelize.transaction(async (t) => {
    const existing = await db.tenantMembership.findOne({
      where: { userId: uid, tenantId: toTid },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (existing) {
      if (existing.status === RETIRED) {
        throw fail('TRANSITION_FORBIDDEN', 'status', 'target membership is retired')
      }
      if (existing.status === ACTIVE) {
        return { target: snapshot(existing), reactivated: false, targetRole: existing.role }
      }
      const targetBefore = snapshot(existing)
      existing.status = ACTIVE
      if (role != null) existing.role = validateRole(role)
      await existing.save({ transaction: t })
      await auditMutation({
        action: 'reactivate',
        actorUserId: act.userId,
        targetUserId: uid,
        tenantId: toTid,
        reason: auditReason,
        requestId: rid,
        before: targetBefore,
        after: snapshot(existing),
        entity: 'membership',
        entityId: existing.id,
        transaction: t
      })
      return { target: snapshot(existing), reactivated: true, targetRole: existing.role }
    }
    const sourcePreview = await db.tenantMembership.findOne({
      where: { userId: uid, tenantId: fromTid },
      transaction: t
    })
    if (!sourcePreview) throw fail('RESOURCE_NOT_FOUND', 'fromTenantId', 'source membership does not exist')
    if (sourcePreview.status === RETIRED) {
      throw fail('TRANSITION_FORBIDDEN', 'status', 'retired membership cannot be moved')
    }
    const targetRole = role == null ? sourcePreview.role : validateRole(role)
    const target = await db.tenantMembership.create(
      { userId: uid, tenantId: toTid, role: targetRole, status: ACTIVE },
      { transaction: t }
    )
    await auditMutation({
      action: 'create',
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: toTid,
      reason: auditReason,
      requestId: rid,
      before: null,
      after: snapshot(target),
      entity: 'membership',
      entityId: target.id,
      transaction: t
    })
    return { target: snapshot(target), reactivated: false, targetRole }
  })

  const sourceOutcome = await db.sequelize.transaction(async (t) => {
    const source = await db.tenantMembership.findOne({
      where: { userId: uid, tenantId: fromTid },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (!source) throw fail('RESOURCE_NOT_FOUND', 'fromTenantId', 'source membership does not exist')
    const sourceBefore = snapshot(source)
    if (source.status === ACTIVE) {
      source.status = DEACTIVATED
      await source.save({ transaction: t })
    }
    await auditMutation({
      action: 'deactivate',
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId: fromTid,
      reason: auditReason,
      requestId: rid,
      before: sourceBefore,
      after: snapshot(source),
      entity: 'membership',
      entityId: source.id,
      transaction: t
    })
    const revokedSessions = await revokeAllUserSessions(db, uid, { transaction: t })
    return { source: snapshot(source), revokedSessions }
  })

  disconnectUser(uid)
  const scope = await postMutationScope(uid)
  return { ...targetOutcome, ...sourceOutcome, scope, requestId: rid }
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

const loadStoreForAssignment = async (storeId, transaction) => {
  const store = await db.location.findByPk(storeId, { attributes: ['id', 'tenantId'], transaction })
  if (!store) throw fail('RESOURCE_NOT_FOUND', 'storeId', 'target store does not exist')
  if (store.tenantId == null) {
    // Reuses the planner vocabulary: a store with no approved tenant cannot
    // anchor an assignment. The persisted location.tenantId is authoritative.
    throw fail('STORE_TENANT_UNRESOLVED', 'storeId', 'target store has no approved tenant')
  }
  return store
}

const requireActiveMembership = async (userId, tenantId, transaction) => {
  const membership = await db.tenantMembership.findOne({
    where: { userId, tenantId },
    transaction
  })
  // Default paranoid scope excludes soft-deleted rows; only ACTIVE counts.
  if (!membership || membership.status !== ACTIVE) {
    throw fail('MEMBERSHIP_REQUIRED', 'storeId', 'user has no active membership in the store tenant')
  }
  return membership
}

async function grantAssignment({ actor, targetUserId, storeId, reason = null, requestId = null } = {}) {
  const act = requireActor(actor)
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const sid = toId(storeId, 'RESOURCE_NOT_FOUND', 'storeId', 'target store')
  const rid = cleanReason(requestId) || crypto.randomUUID()
  const auditReason = cleanReason(reason)

  const user = await db.user.findByPk(uid, { attributes: ['id'] })
  if (!user) throw fail('RESOURCE_NOT_FOUND', 'userId', 'target user does not exist')
  const store = await loadStoreForAssignment(sid, undefined)
  assertAssignmentAuthority(act, store.tenantId, store.id)
  await requireActiveMembership(uid, store.tenantId, undefined)

  const grantIn = (t, verb, before, after, entityId) =>
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

  let outcome
  try {
    outcome = await db.sequelize.transaction(async (t) => {
      const row = await db.storeAssignment.create(
        { userId: uid, tenantId: store.tenantId, storeId: store.id },
        { transaction: t }
      )
      const auditRow = await grantIn(t, 'grant', null, snapshot(row), row.id)
      return { assignment: snapshot(row), created: true, noOp: false, auditId: auditRow.id }
    })
  } catch (err) {
    // A lost unique race aborts the Postgres transaction: normalize from
    // committed state outside it instead of surfacing a raw 500.
    if (err == null || err.name !== 'SequelizeUniqueConstraintError') throw err
    const row = await db.storeAssignment.findOne({ where: { userId: uid, storeId: store.id } })
    if (!row) throw err
    if (Number(row.tenantId) !== Number(store.tenantId)) {
      // Stale tenant-inconsistent row (only possible via hook bypass):
      // cannot be normalized into the idempotent contract.
      throw fail('ASSIGNMENT_CONFLICT', 'storeId', 'existing assignment targets a different tenant')
    }
    outcome = { assignment: snapshot(row), created: false, noOp: true, auditId: null }
  }

  const scope = await postMutationScope(uid)
  return { ...outcome, scope, requestId: rid }
}

async function revokeAssignment({ actor, targetUserId, storeId, reason = null, requestId = null } = {}) {
  const act = requireActor(actor)
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const sid = toId(storeId, 'RESOURCE_NOT_FOUND', 'storeId', 'target store')

  const row = await db.storeAssignment.findOne({ where: { userId: uid, storeId: sid } })
  if (!row) {
    // Idempotent revoke: the desired end state (no assignment) already holds.
    const scope = await postMutationScope(uid)
    return { revoked: false, noOp: true, auditId: null, revokedSessions: [], scope, requestId: cleanReason(requestId) || crypto.randomUUID() }
  }
  const store = await loadStoreForAssignment(sid, undefined)
  assertAssignmentAuthority(act, store.tenantId, store.id)
  const auditReason = requireReason(reason)
  const rid = cleanReason(requestId) || crypto.randomUUID()
  const before = snapshot(row)

  const outcome = await db.sequelize.transaction(async (t) => {
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
    // Targeted revocation: only sessions that selected the removed store are
    // affected. Enlisted so a rolled-back revoke never revokes.
    const sessions = await db.authorizationContextSession.findAll({
      where: { userId: uid, activeStoreId: sid, revokedAt: null },
      attributes: ['sessionId'],
      transaction: t
    })
    const revokedSessions = []
    for (const session of sessions) {
      const revoked = await revokeContextSession(db, session.sessionId, uid, { transaction: t })
      if (revoked) revokedSessions.push(session.sessionId)
    }
    return { auditId: auditRow.id, revokedSessions }
  })

  for (const sessionId of outcome.revokedSessions) {
    disconnectSession(sessionId)
  }
  const scope = await postMutationScope(uid)
  return { revoked: true, noOp: false, scope, requestId: rid, ...outcome }
}

// Atomic store relocation: revoke at fromStoreId and grant at toStoreId in
// one transaction. Authority is required at BOTH ends; the target tenant
// must hold an ACTIVE membership (same rule as grant). Cross-tenant moves
// additionally require that membership; use grant+revoke separately when
// the caller only holds single-side authority.
async function moveAssignment({ actor, targetUserId, fromStoreId, toStoreId, reason, requestId = null } = {}) {
  const act = requireActor(actor)
  const uid = toId(targetUserId, 'RESOURCE_NOT_FOUND', 'userId', 'target user')
  const fromSid = toId(fromStoreId, 'RESOURCE_NOT_FOUND', 'fromStoreId', 'source store')
  const toSid = toId(toStoreId, 'RESOURCE_NOT_FOUND', 'toStoreId', 'target store')
  if (Number(fromSid) === Number(toSid)) {
    return {
      moved: false,
      noOp: true,
      scope: await postMutationScope(uid),
      requestId: cleanReason(requestId) || crypto.randomUUID()
    }
  }
  const auditReason = requireReason(reason)
  const rid = cleanReason(requestId) || crypto.randomUUID()

  const fromStore = await loadStoreForAssignment(fromSid, undefined)
  const toStore = await loadStoreForAssignment(toSid, undefined)
  assertAssignmentAuthority(act, fromStore.tenantId, fromStore.id)
  assertAssignmentAuthority(act, toStore.tenantId, toStore.id)
  await requireActiveMembership(uid, toStore.tenantId, undefined)

  const moveIn = (t, verb, tenantId, storeId, before, after, entityId) =>
    auditMutation({
      action: verb,
      actorUserId: act.userId,
      targetUserId: uid,
      tenantId,
      storeId,
      reason: auditReason,
      requestId: rid,
      before,
      after,
      entity: 'assignment',
      entityId,
      transaction: t
    })

  // One bounded retry: if a concurrent grant wins the target between the
  // pre-check and the transaction, the unique violation aborts the attempt
  // and the retry observes the now-existing target (revoke-only path).
  let outcome = null
  for (let attempt = 0; attempt < 2 && outcome == null; attempt += 1) {
    const targetExists = await db.storeAssignment.findOne({ where: { userId: uid, storeId: toSid } })
    if (targetExists && Number(targetExists.tenantId) !== Number(toStore.tenantId)) {
      throw fail('ASSIGNMENT_CONFLICT', 'toStoreId', 'existing assignment targets a different tenant')
    }
    try {
      outcome = await db.sequelize.transaction(async (t) => {
        const oldRow = await db.storeAssignment.findOne({
          where: { userId: uid, storeId: fromSid },
          transaction: t,
          lock: t.LOCK.UPDATE
        })
        if (!oldRow) throw fail('RESOURCE_NOT_FOUND', 'fromStoreId', 'source assignment does not exist')
        const oldBefore = snapshot(oldRow)
        await oldRow.destroy({ transaction: t })
        const revokeAudit = await moveIn(t, 'revoke', fromStore.tenantId, fromStore.id, oldBefore, null, oldBefore.id)

        let created = true
        if (!targetExists) {
          const newRow = await db.storeAssignment.create(
            { userId: uid, tenantId: toStore.tenantId, storeId: toStore.id },
            { transaction: t }
          )
          await moveIn(t, 'grant', toStore.tenantId, toStore.id, null, snapshot(newRow), newRow.id)
        } else {
          created = false
        }

        const sessions = await db.authorizationContextSession.findAll({
          where: { userId: uid, activeStoreId: fromSid, revokedAt: null },
          attributes: ['sessionId'],
          transaction: t
        })
        const revokedSessions = []
        for (const session of sessions) {
          const revoked = await revokeContextSession(db, session.sessionId, uid, { transaction: t })
          if (revoked) revokedSessions.push(session.sessionId)
        }
        return { moved: true, created, revokeAuditId: revokeAudit.id, revokedSessions }
      })
    } catch (err) {
      if (err == null || err.name !== 'SequelizeUniqueConstraintError' || attempt === 1) throw err
      // Lost the target race: loop once more; the pre-check now sees it.
    }
  }

  for (const sessionId of outcome.revokedSessions) {
    disconnectSession(sessionId)
  }
  const scope = await postMutationScope(uid)
  return { ...outcome, scope, requestId: rid }
}

module.exports = {
  ROLE_RANK,
  MEMBERSHIP_TRANSITIONS,
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
