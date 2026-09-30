'use strict'

// T-03B canonical HTTP helpers for the membership / assignment /
// effective-scope routes. These routes always run behind `authorization` →
// `authorizationContextMiddleware`, whose own 401 / stale-context 403 bodies
// are left untouched; this module only shapes controller responses.
//
//   success: { success: true, message, data }
//   error:   { success: false, code, field, message }   (field may be null)
//
// Service errors already carry the canonical { code, field, message }; they
// are mapped to an HTTP status here and normally pass through unchanged. The
// single intentional exception is the store_admin persisted-target
// ROLE_CEILING, which is visibility-adjusted to RESOURCE_NOT_FOUND (see
// visibilityAdjusted below). Anything without a
// known code is an unexpected failure: logged server-side, answered as a
// generic 500 that exposes no internal detail.

const STATUS_BY_CODE = Object.freeze({
  INVALID_ROLE: 400,
  INVALID_REASON: 400,
  INVALID_REQUEST_ID: 400,
  INVALID_OPERATION: 400,
  FORBIDDEN: 403,
  ROLE_CEILING: 403,
  RESOURCE_NOT_FOUND: 404,
  TRANSITION_FORBIDDEN: 409,
  ASSIGNMENT_CONFLICT: 409,
  MEMBERSHIP_REQUIRED: 409,
  STORE_TENANT_UNRESOLVED: 409
})

// The mutation actor comes ONLY from the server-resolved canonical context of
// the authenticated session — never from body, query, path or token claims.
// A global legacy super_admin resolves to activeRole 'platform_admin' there
// (compatibility alias), a store-bound one does not.
const actorFrom = (req) => {
  const ctx = req.authContext || {}
  return {
    userId: req.user?.id,
    role: ctx.activeRole ?? null,
    tenantId: ctx.activeTenantId ?? null,
    storeId: ctx.activeStoreId ?? null
  }
}

const ok = (res, data, status = 200) => res.status(status).json({ success: true, message: 'Success', data })

// Collections follow the repository's list convention: the rows in `data`
// and a sibling `pagination: { page, limit, total, totalPages }`.
const okPage = (res, { items, pagination }) =>
  res.status(200).json({ success: true, message: 'Success', data: items, pagination })

// D8 store-admin visibility: a target ranked at or above store_admin is
// invisible to a store_admin, so the T-03A persisted-target ROLE_CEILING is
// answered exactly like a nonexistent user (same status, code, field and
// message as the service's notFound('userId')).
const visibilityAdjusted = (err, actorRole) => {
  if (actorRole === 'store_admin' && err.code === 'ROLE_CEILING' && err.field === 'targetUserId') {
    return { code: 'RESOURCE_NOT_FOUND', field: 'userId', message: 'userId not found' }
  }
  return { code: err.code, field: err.field ?? null, message: err.message }
}

const sendError = (res, err, { actorRole = null } = {}) => {
  if (err && typeof err.code === 'string' && STATUS_BY_CODE[err.code]) {
    const body = visibilityAdjusted(err, actorRole)
    return res.status(STATUS_BY_CODE[body.code]).json({ success: false, ...body })
  }
  console.error('[canonical-http] unexpected error:', err)
  return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Internal Server Error' })
}

module.exports = { STATUS_BY_CODE, actorFrom, ok, okPage, sendError }
