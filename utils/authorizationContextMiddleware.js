'use strict'

// TASK 3 — server-side authorization context middleware (F5).
//
// Chain per request:
//   1. authenticate identity (JWT verify — identity only);
//   2. load the server-side context session by opaque sessionId;
//   3. resolve the canonical authorization context from persisted state;
//   4. validate membership / tenant lifecycle / store ownership /
//      assignment / store lifecycle;
//   5. attach the resolved context to req.authContext.
//
// req.user remains identity data only. JWT role/store claims, cookies,
// query/body store values, and frontend activeStore are NEVER authority —
// they are at most candidates, and this middleware only honors the
// server-persisted session selection (validated against the DB).

const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { resolveAuthorizationContext } = require('./authContext')

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

const getToken = (req) => {
  if (req?.cookies?.token) return req.cookies.token
  const header = req?.headers?.authorization
  if (header && header.startsWith('Bearer ')) return header.substring(7)
  return null
}

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

async function createContextSession(database, { userId, activeTenantId = null, activeStoreId = null, ttlMs = DEFAULT_TTL_MS } = {}) {
  const db = database || require('../db/models')
  const uid = toPositiveIntOrNull(userId)
  if (uid == null) throw new Error('CONTEXT_SESSION_INVALID_USER')
  const now = new Date()
  const row = await db.authorizationContextSession.create({
    sessionId: newSessionId(),
    userId: uid,
    activeTenantId: toPositiveIntOrNull(activeTenantId),
    activeStoreId: toPositiveIntOrNull(activeStoreId),
    version: 1,
    expiresAt: new Date(now.getTime() + ttlMs),
    revokedAt: null
  })
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

async function revokeContextSession(database, sessionId, userId) {
  const db = database || require('../db/models')
  const row = await db.authorizationContextSession.findOne({ where: { sessionId } })
  if (!row) return false
  if (userId != null && Number(row.userId) !== Number(userId)) return false
  if (row.revokedAt != null) return true
  row.revokedAt = new Date()
  row.version = Number(row.version || 1) + 1
  await row.save()
  return true
}

// Atomic tenant switch: validates the tenant as an effective membership via
// the canonical resolver BEFORE persisting; failure leaves the row untouched.
// Switching tenant always clears the store selection (stale store must never
// survive a tenant change).
async function switchSessionTenant(database, sessionId, userId, tenantId) {
  const db = database || require('../db/models')
  const target = toPositiveIntOrNull(tenantId)
  if (target == null) throw new Error('CONTEXT_TENANT_INVALID')
  const row = await db.authorizationContextSession.findOne({ where: { sessionId } })
  if (!row || row.revokedAt != null) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  if (Number(row.userId) !== Number(userId)) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  if (row.expiresAt != null && new Date(row.expiresAt).getTime() <= Date.now()) {
    throw new Error('CONTEXT_SESSION_EXPIRED')
  }
  // Dry-run through the canonical resolver: only an effective membership passes.
  const probe = await resolveAuthorizationContext(db, { userId, activeTenantId: target })
  if (probe.activeTenantId !== target) {
    throw new Error(`CONTEXT_TENANT_FORBIDDEN:${probe.reason || 'foreign-or-inactive-tenant'}`)
  }
  const t = await db.sequelize.transaction()
  try {
    const locked = await db.authorizationContextSession.findOne({
      where: { sessionId },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (!locked || locked.revokedAt != null) throw new Error('CONTEXT_SESSION_NOT_FOUND')
    locked.activeTenantId = target
    locked.activeStoreId = null
    locked.version = Number(locked.version || 1) + 1
    await locked.save({ transaction: t })
    await t.commit()
    return locked
  } catch (err) {
    await t.rollback()
    throw err
  }
}

// Atomic store switch: the store must belong to the session's active tenant
// AND satisfy assignment rules for the resolved role (resolver dry-run).
async function switchSessionStore(database, sessionId, userId, storeId) {
  const db = database || require('../db/models')
  const target = toPositiveIntOrNull(storeId)
  if (target == null) throw new Error('CONTEXT_STORE_INVALID')
  const row = await db.authorizationContextSession.findOne({ where: { sessionId } })
  if (!row || row.revokedAt != null) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  if (Number(row.userId) !== Number(userId)) throw new Error('CONTEXT_SESSION_NOT_FOUND')
  if (row.expiresAt != null && new Date(row.expiresAt).getTime() <= Date.now()) {
    throw new Error('CONTEXT_SESSION_EXPIRED')
  }
  if (row.activeTenantId == null) throw new Error('CONTEXT_TENANT_REQUIRED')
  const probe = await resolveAuthorizationContext(db, {
    userId,
    activeTenantId: row.activeTenantId,
    activeStoreId: target
  })
  if (probe.activeStoreId !== target) {
    throw new Error(`CONTEXT_STORE_FORBIDDEN:${probe.reason || 'foreign-store'}`)
  }
  const t = await db.sequelize.transaction()
  try {
    const locked = await db.authorizationContextSession.findOne({
      where: { sessionId },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (!locked || locked.revokedAt != null) throw new Error('CONTEXT_SESSION_NOT_FOUND')
    // Re-check tenant did not change under us.
    if (Number(locked.activeTenantId) !== Number(row.activeTenantId)) {
      throw new Error('CONTEXT_STALE')
    }
    locked.activeStoreId = target
    locked.version = Number(locked.version || 1) + 1
    await locked.save({ transaction: t })
    await t.commit()
    return locked
  } catch (err) {
    await t.rollback()
    throw err
  }
}

const authorizationContextMiddleware = async (req, res, next) => {
  const db = modelsOf(req, req?.db)
  const token = getToken(req)
  if (!token) {
    return res.status(401).json({ message: 'User Belum Login', code: 'UNAUTHENTICATED' })
  }
  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY)
  } catch {
    return res.status(401).json({ message: 'Token Tidak Valid', code: 'INVALID_TOKEN' })
  }
  // Identity only — role/store claims inside the token are never consulted.
  req.user = decoded

  const sessionId = typeof decoded.sessionId === 'string' ? decoded.sessionId : null
  if (!sessionId) {
    // Legacy token (no session): resolve identity-only context. No tenant or
    // store authority is granted — callers requiring scope will fail closed.
    const ctx = await resolveAuthorizationContext(db, { userId: decoded.id })
    req.authContext = ctx
    req.authSession = null
    return next()
  }

  const session = await loadContextSession(db, sessionId)
  if (!session || Number(session.userId) !== Number(decoded.id)) {
    return res.status(401).json({ message: 'Session revoked or expired', code: 'SESSION_INVALID' })
  }

  const ctx = await resolveAuthorizationContext(db, {
    userId: decoded.id,
    activeTenantId: session.activeTenantId,
    activeStoreId: session.activeStoreId
  })

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
  switchSessionTenant,
  switchSessionStore
}
