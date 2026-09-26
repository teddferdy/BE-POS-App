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

const setUserContext = (decoded) => {
  const store = userContext.getStore()
  if (store) {
    store.userId = decoded.id
    store.userName = decoded.userName
    store.fullName = decoded.fullName
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

const authorization = (req, res, next) => {
  const getTokenValue = getToken(req)

  if (!getTokenValue) {
    return res.status(401).json({
      message: 'User Belum Login'
    })
  }

  try {
    const decoded = jwt.verify(getTokenValue, process.env.JWT_SECRET_KEY)
    req.user = decoded
    setUserContext(decoded)
    return next()
  } catch {
    return res.status(401).json({
      message: 'Token Tidak Valid'
    })
  }
}

const requireRole = (...roles) => {
  // COMPATIBILITY ONLY (cutover boundary): keeps legacy route guards working
  // while routes migrate to requireCanonicalPermission. Compares the
  // token's roleType string and grants NO canonical scope — any route that
  // needs tenant/store authority must additionally pass the canonical gate.
  return (req, res, next) => {
    if (!req.user) {
      const token = getToken(req)
      if (!token) {
        return res.status(401).json({ message: 'User Belum Login' })
      }
      try {
        req.user = jwt.verify(token, process.env.JWT_SECRET_KEY)
        setUserContext(req.user)
      } catch {
        return res.status(401).json({ message: 'Token Tidak Valid' })
      }
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
