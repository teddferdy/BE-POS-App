'use strict'

// TASK 3 — server-side authorization context middleware (F5).
//
// Chain per request:
//   1. canonical `authorization` (utils/authorization.js) verifies the JWT,
//      loads + validates the session with its account and hydrates req.user;
//   2. this middleware resolves the canonical authorization context from
//      persisted state for that session (reusing the loaded account);
//   3. validate membership / tenant lifecycle / store ownership /
//      assignment / store lifecycle;
//   4. attach the resolved context to req.authContext.
//
// JWT role/store claims, cookies, query/body store values, and frontend
// activeStore are NEVER authority — they are at most candidates, and this
// middleware only honors the server-persisted session selection (validated
// against the DB).

const crypto = require('crypto')
const { resolveAuthorizationContext } = require('./authContext')
const { credentialWindow } = require('./jwtConvert')
const { lockUserMemberships, lockAssignment } = require('./membershipLocks')

const toPositiveIntOrNull = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

const modelsOf = (req, explicitDb) =>
  explicitDb || req?.db || req?.app?.get?.('db') || require('../db/models')

const newSessionId = () => crypto.randomBytes(32).toString('hex')

// Expiry: an explicit `expiresAt` (login passes its JWT's exp), else an
// explicit `ttlMs`, else the single authentication lifetime (JWT_EXPIRED_IN).
async function createContextSession(
  database,
  { userId, activeTenantId = null, activeStoreId = null, ttlMs, expiresAt, transaction } = {}
) {
  const db = database || require('../db/models')
  const uid = toPositiveIntOrNull(userId)
  if (uid == null) throw new Error('CONTEXT_SESSION_INVALID_USER')
  let expiry
  if (expiresAt != null) expiry = new Date(expiresAt)
  else if (ttlMs != null) expiry = new Date(Date.now() + ttlMs)
  else expiry = new Date(credentialWindow().exp * 1000)
  const row = await db.authorizationContextSession.create(
    {
      sessionId: newSessionId(),
      // T-03B (DR-03 Q8): the session's authentication instant comes from
      // the database clock, the same source as tenant_membership.reactivatedAt,
      // so the freshness comparison never mixes app-server clocks.
      createdAt: db.sequelize.fn('NOW'),
      userId: uid,
      activeTenantId: toPositiveIntOrNull(activeTenantId),
      activeStoreId: toPositiveIntOrNull(activeStoreId),
      version: 1,
      expiresAt: expiry,
      revokedAt: null
    },
    { transaction }
  )
  return row
}

async function loadContextSession(database, sessionId) {
  const db = database || require('../db/models')
  if (typeof sessionId !== 'string' || sessionId.length < 32) return null
  const row = await db.authorizationContextSession.findOne({ where: { sessionId } })
  if (!row) return null
  if (row.revokedAt != null) return null
  if (row.expiresAt != null && new Date(row.expiresAt).getTime() <= Date.now()) return null
  return row
}

// AUTH-1 P3: revocation is write-once. The stamp is a conditional UPDATE on
// `revokedAt IS NULL`, so a repeated or concurrent revocation never moves the
// original timestamp, and no code path ever clears it. Both primitives accept
// the caller's transaction so revocation commits atomically with the
// account mutation that triggered it.
const REVOKE_VALUES = (db) => ({ revokedAt: new Date(), version: db.sequelize.literal('"version" + 1') })

// Revokes one session (owned by `userId` when given). Returns false when no
// such session exists, true when it is — or already was — revoked.
async function revokeContextSession(database, sessionId, userId, { transaction } = {}) {
  const db = database || require('../db/models')
  if (typeof sessionId !== 'string' || !sessionId) return false
  const where = userId != null ? { sessionId, userId } : { sessionId }
  const row = await db.authorizationContextSession.findOne({ where, attributes: ['id'], transaction })
  if (!row) return false
  await db.authorizationContextSession.update(REVOKE_VALUES(db), {
    where: { ...where, revokedAt: null },
    transaction
  })
  return true
}

// Revokes every not-yet-revoked session of one user. Returns the count
// newly revoked; already-revoked rows keep their original timestamp.
async function revokeAllUserSessions(database, userId, { transaction } = {}) {
  const db = database || require('../db/models')
  const [count] = await db.authorizationContextSession.update(REVOKE_VALUES(db), {
    where: { userId, revokedAt: null },
    transaction
  })
  return count
}

// Locked-session ownership/liveness checks shared by both switches.
const assertSwitchableSession = (row, userId) => {
  if (!row || row.revokedAt != null) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  if (Number(row.userId) !== Number(userId)) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  if (row.expiresAt != null && new Date(row.expiresAt).getTime() <= Date.now()) {
    throw new Error('CONTEXT_SESSION_EXPIRED')
  }
}

// Atomic tenant switch. T-03B: validation and write are ONE transaction,
// serialized with T-03A membership reductions by the shared lock order
// (utils/membershipLocks): the user's membership set, then the session row.
// The canonical resolver re-runs inside that transaction with the session's
// authentication instant, so the membership authorizing the switch is still
// effective — and fresh for this session — when the session row commits.
// Failure leaves the row untouched. Switching tenant always clears the store
// selection (stale store must never survive a tenant change).
async function switchSessionTenant(database, sessionId, userId, tenantId) {
  const db = database || require('../db/models')
  const target = toPositiveIntOrNull(tenantId)
  if (target == null) throw new Error('CONTEXT_TENANT_INVALID')
  const uid = toPositiveIntOrNull(userId)
  if (uid == null || typeof sessionId !== 'string' || !sessionId) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  return db.sequelize.transaction(async (t) => {
    await lockUserMemberships(db, uid, t)
    const locked = await db.authorizationContextSession.findOne({
      where: { sessionId },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    assertSwitchableSession(locked, uid)
    // Dry-run through the canonical resolver: only an effective membership passes.
    const probe = await resolveAuthorizationContext(db, {
      userId: uid,
      activeTenantId: target,
      transaction: t,
      authenticatedAt: locked.createdAt
    })
    if (probe.activeTenantId !== target) {
      throw new Error(`CONTEXT_TENANT_FORBIDDEN:${probe.reason || 'foreign-or-inactive-tenant'}`)
    }
    locked.activeTenantId = target
    locked.activeStoreId = null
    locked.version = Number(locked.version || 1) + 1
    await locked.save({ transaction: t })
    return locked
  })
}

// Atomic store switch: the store must belong to the session's active tenant
// AND satisfy assignment rules for the resolved role. T-03B: one transaction
// in the shared lock order — membership set, the target assignment row, then
// the session row — so a concurrent membership reduction or assignment revoke
// either lands before the re-run canonical resolver (switch denied) or after
// the session row commits (and then revokes it).
async function switchSessionStore(database, sessionId, userId, storeId) {
  const db = database || require('../db/models')
  const target = toPositiveIntOrNull(storeId)
  if (target == null) throw new Error('CONTEXT_STORE_INVALID')
  const uid = toPositiveIntOrNull(userId)
  if (uid == null || typeof sessionId !== 'string' || !sessionId) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  return db.sequelize.transaction(async (t) => {
    await lockUserMemberships(db, uid, t)
    await lockAssignment(db, uid, target, t)
    const locked = await db.authorizationContextSession.findOne({
      where: { sessionId },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    assertSwitchableSession(locked, uid)
    if (locked.activeTenantId == null) throw new Error('CONTEXT_TENANT_REQUIRED')
    const probe = await resolveAuthorizationContext(db, {
      userId: uid,
      activeTenantId: locked.activeTenantId,
      activeStoreId: target,
      transaction: t,
      authenticatedAt: locked.createdAt
    })
    if (probe.activeStoreId !== target) {
      throw new Error(`CONTEXT_STORE_FORBIDDEN:${probe.reason || 'foreign-store'}`)
    }
    locked.activeStoreId = target
    locked.version = Number(locked.version || 1) + 1
    await locked.save({ transaction: t })
    return locked
  })
}

// AUTH-1 P2: runs after canonical `authorization`, which already verified the
// JWT, loaded and validated the session and hydrated req.user from the DB.
// This middleware reuses req.authSession / req.user — no second verify, no
// second session lookup — and fails closed when mounted without them.
const authorizationContextMiddleware = async (req, res, next) => {
  const db = modelsOf(req, req?.db)
  const session = req.authSession
  if (!session || !req.user || Number(session.userId) !== Number(req.user.id)) {
    return res.status(401).json({ message: 'User Belum Login', code: 'UNAUTHENTICATED' })
  }

  let ctx
  try {
    ctx = await resolveAuthorizationContext(db, {
      userId: req.user.id,
      activeTenantId: session.activeTenantId,
      activeStoreId: session.activeStoreId,
      account: session.user,
      // T-03B (DR-03 Q8): reactivation freshness for this session.
      authenticatedAt: session.createdAt
    })
  } catch {
    return res.status(500).json({ message: 'Internal Server Error', code: 'AUTHORIZATION_ERROR' })
  }

  // Stale-context rejection: the session names a tenant/store that no longer
  // resolves (membership revoked, tenant suspended/deleted, store deleted,
  // assignment revoked). Fail closed with a deterministic code.
  if (session.activeTenantId != null && ctx.activeTenantId == null) {
    req.authContext = ctx
    return res.status(403).json({
      message: 'Context tenant is no longer authorized',
      code: 'STALE_TENANT_CONTEXT',
      reason: ctx.reason || 'foreign-or-inactive-tenant'
    })
  }
  if (session.activeStoreId != null && ctx.activeStoreId == null) {
    req.authContext = ctx
    return res.status(403).json({
      message: 'Context store is no longer authorized',
      code: 'STALE_STORE_CONTEXT',
      reason: ctx.reason || 'foreign-store'
    })
  }

  req.authContext = ctx
  req.authSession = session
  return next()
}

module.exports = {
  authorizationContextMiddleware,
  createContextSession,
  loadContextSession,
  revokeContextSession,
  revokeAllUserSessions,
  switchSessionTenant,
  switchSessionStore
}
