const jwt = require('jsonwebtoken')
const userContext = require('./userContext')

// ---------------------------------------------------------------------------
// Canonical cutover boundary (F5/TASK 6).
//
//   authentication = identity (this module verifies WHO the caller is);
//   authorization  = persisted current DB state + resolved context
//                  (utils/authContext.js + req.authContext).
//
// The following NEVER independently authorize, and are never consulted by
// the canonical path: req.user.roleType, req.user.store, req.cookies.store,
// query.storeId, body.storeId, frontend activeStore, JWT role claims, JWT
// store claims. requireRole() below remains ONLY as compatibility
// infrastructure while routes are progressively migrated — it must not
// create authority that contradicts canonical authorization, and it grants
// no canonical scope by itself (see requireCanonicalPermission).
// validateStoreAccess (utils/storeValidation.js) cannot grant authority
// either: with a resolved context it validates candidates canonically and
// fails closed. A rollback state must still fail closed unless an
// explicitly controlled migration state authorizes compatibility — there is
// no implicit legacy fallback anywhere in this module.
// ---------------------------------------------------------------------------

const setUserContext = (user) => {
  const store = userContext.getStore()
  if (store) {
    store.userId = user.id
    store.userName = user.userName
    store.fullName = user.fullName
  }
}

const getToken = (req) => {
  let token = req?.cookies?.token
  if (!token) {
    const authHeader = req?.headers?.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }
  return token
}

const SESSION_INVALID = { message: 'Session revoked or expired', code: 'SESSION_INVALID' }

// Account columns legacy authorization reads; hydrated into req.user.
const ACCOUNT_ATTRIBUTES = ['id', 'userName', 'fullName', 'roleType', 'roleId', 'store', 'disabledAt', 'deletedAt']

// One query: the session row joined with its owning account. paranoid:false
// so a soft-deleted owner is seen (and denied) rather than silently absent.
const loadAuthenticatedSession = (db, sessionId) =>
  db.authorizationContextSession.findOne({
    where: { sessionId },
    include: [
      { model: db.user, as: 'user', required: false, paranoid: false, attributes: ACCOUNT_ATTRIBUTES }
    ]
  })

// AUTH-1 P2 canonical authentication. The JWT proves only `id` + `sessionId`;
// every authenticated request must present a live DB session owned by that
// id, and req.user is hydrated from the current account row — mutable JWT
// claims (roleType, roleId, store, names) never reach authorization. Order:
// credential → signature → sessionId → session+account (one query) →
// session live and owned → account eligible (disabledAt/deletedAt only;
// presence `status` is not authority) → hydrate → next(). A lookup failure
// is 500 and never falls through to next().
const authorization = async (req, res, next) => {
  const token = getToken(req)

  if (!token) {
    return res.status(401).json({
      message: 'User Belum Login'
    })
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY)
  } catch {
    return res.status(401).json({
      message: 'Token Tidak Valid'
    })
  }

  const sessionId = typeof decoded?.sessionId === 'string' ? decoded.sessionId : null
  if (!sessionId || sessionId.length < 32) {
    return res.status(401).json(SESSION_INVALID)
  }

  let session
  try {
    session = await loadAuthenticatedSession(require('../db/models'), sessionId)
  } catch {
    return res.status(500).json({
      message: 'Internal Server Error'
    })
  }

  if (
    !session ||
    session.revokedAt != null ||
    new Date(session.expiresAt).getTime() <= Date.now() ||
    Number(session.userId) !== Number(decoded.id)
  ) {
    return res.status(401).json(SESSION_INVALID)
  }

  // P1-4 contract: a missing, soft-deleted or disabled account is denied
  // with the existing authorization denial shape.
  const account = session.user
  if (!account || account.deletedAt != null || account.disabledAt != null) {
    return res.status(403).json({
      message: 'Akses Ditolak - Anda tidak memiliki izin'
    })
  }

  req.user = {
    id: account.id,
    userName: account.userName,
    fullName: account.fullName,
    roleType: account.roleType,
    roleId: account.roleId,
    store: account.store,
    disabledAt: account.disabledAt,
    deletedAt: account.deletedAt,
    sessionId
  }
  req.authSession = session
  setUserContext(req.user)
  return next()
}

const requireRole = (...roles) => {
  // Role gate over the account hydrated by `authorization` (current DB
  // roleType). It never authenticates and never reads JWT claims: without
  // an authenticated session it fails closed. Grants NO canonical scope —
  // routes needing tenant/store authority must also pass the canonical gate.
  return (req, res, next) => {
    if (!req.authSession || !req.user) {
      return res.status(401).json({ message: 'User Belum Login' })
    }

    if (!roles.includes(req.user.roleType)) {
      return res.status(403).json({
        message: 'Akses Ditolak - Anda tidak memiliki izin'
      })
    }

    return next()
  }
}

module.exports = authorization
module.exports.requireRole = requireRole
module.exports.setUserContext = setUserContext
module.exports.getToken = getToken

// Canonical permission gate for migrated routes.
//
// Usage: app.get('/x', authorization, authorizationContextMiddleware,
//                 requireCanonicalPermission('store.manage',
//                   (req) => ({ tenantId: req.params.tenantId })), handler)
//
// - Resolves the context from req.authContext when attached (preferred), or
//   from persisted state for the authenticated user otherwise.
// - scopeOf(req) supplies the persisted resource's OWN tenantId/storeId
//   (loaded from the DB row — never request input as authority).
// - Denies with 401 when identity is missing/ineligible, 403 otherwise.
// - Legacy signals (JWT claims, cookies, query/body, frontend state) are
//   never consulted: they cannot satisfy this gate by themselves.
const requireCanonicalPermission = (permission, scopeOf) => {
  return async (req, res, next) => {
    try {
      const { resolveAuthorizationContext, canAccessResource } = require('./authContext')
      const db = req?.db || require('../db/models')
      let ctx = req?.authContext
      if (!ctx) {
        const userId = req?.user?.id
        if (userId == null) {
          return res.status(401).json({ message: 'User Belum Login', code: 'UNAUTHENTICATED' })
        }
        ctx = await resolveAuthorizationContext(db, { userId })
        req.authContext = ctx
      }
      if (!ctx || ctx.eligible !== true) {
        return res.status(401).json({ message: 'Unauthorized', code: 'INELIGIBLE_ACCOUNT' })
      }
      let scope = {}
      if (typeof scopeOf === 'function') {
        scope = (await scopeOf(req)) || {}
      } else if (scopeOf && typeof scopeOf === 'object') {
        scope = scopeOf
      }
      // Only persisted ownership fields participate — strip anything else so
      // a caller cannot smuggle authority through extra scope keys.
      const resource = { tenantId: scope.tenantId ?? null, storeId: scope.storeId ?? null }
      if (!canAccessResource(ctx, permission, resource)) {
        return res.status(403).json({
          message: 'Akses Ditolak - Anda tidak memiliki izin',
          code: 'FORBIDDEN'
        })
      }
      return next()
    } catch {
      return res.status(500).json({ message: 'Internal Server Error', code: 'AUTHORIZATION_ERROR' })
    }
  }
}

module.exports.requireCanonicalPermission = requireCanonicalPermission
// authentication is the identity-only contract: verify WHO, never WHAT they may do.
module.exports.authentication = authorization
