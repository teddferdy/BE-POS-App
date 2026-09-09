// Parse a client-supplied store value into an array of numeric store IDs
// WITHOUT relying on JavaScript coercion tricks (parseInt(array) -> first
// element, parseInt('"[5]"') -> NaN). Distinguishes scalar string/number,
// number array, JSON-string-array, comma-separated, malformed, null/empty.
//
// Returns an array of numbers (possibly empty). This is PURE NORMALIZATION —
// authorization is a separate concern (see authorizedStoreIds below).
const normalizeStoreIds = (value) => {
  if (value === undefined || value === null || value === '') return []

  // Number array (the JSON-array body shape used by multi-store forms).
  if (Array.isArray(value)) {
    return value
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0)
  }

  // String: try JSON array first, then comma/space splits, then scalar.
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return []
    if (trimmed === 'all') return [] // handled as global by caller semantics
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0)
      }
    } catch {
      // fall through
    }
    const parts = trimmed
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length > 1) {
      return parts
        .map(Number)
        .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0)
    }
    const n = Number(trimmed)
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) return [n]
    return []
  }

  // number / anything else
  const n = Number(value)
  if (Number.isFinite(n) && Number.isInteger(n) && n > 0) return [n]
  return []
}

// Canonical multi-store authorization rule (C-1..C-4 root cause).
//
// For a NON-super-admin with authoritative store req.storeId (the JWT `store`
// claim pinned by validateStoreAccess):
//   requestedStores MUST be a subset of {req.storeId}.
// Since a single-store tenant can only ever be authorized for exactly its own
// store, ANY element that is not exactly req.storeId — or ANY representation
// that does not collapse to {req.storeId} — makes the WHOLE request
// unauthorized and MUST be rejected with no partial mutation.
//
// Returns either:
//   { ok: true, stores: [req.storeId] }   (the caller may proceed, pinned to own)
//   { ok: false }                         (reject the entire request; caller
//                                          must write nothing, emit nothing)
//
// For super_admin the caller owns multi-store/global semantics and should NOT
// use this helper — it guards the single-store tenant default only.
const authorizedStoreIds = (req) => {
  const userRole = req.user?.roleType
  const userStore = Number(req.user?.store)
  if (userRole !== 'super_admin' && Number.isFinite(userStore) && userStore > 0) {
    // Single-store tenant: authoritative writes may go to exactly {req.storeId}.
    const hasBodyStore =
      req.body && (req.body.store !== undefined || req.body.storeId !== undefined)
    const hasQueryStore = req.query && req.query.store !== undefined
    const supplied = hasBodyStore
      ? req.body.store !== undefined
        ? req.body.store
        : req.body.storeId
      : hasQueryStore
        ? req.query.store
        : undefined

    // Omitted / empty / 'all' store -> default to own store. This is the
    // safe, non-expanding interpretation: it never lets a single-store tenant
    // touch a foreign or global/null-store namespace.
    if (supplied === undefined || supplied === null || supplied === '' || supplied === 'all') {
      return { ok: true, stores: [userStore] }
    }

    const candidates = normalizeStoreIds(supplied)
    // Fail closed on any ambiguity for a single-store tenant.
    if (candidates.length === 0) return { ok: false }
    for (const c of candidates) {
      if (c !== userStore) return { ok: false }
    }
    return { ok: true, stores: [userStore] }
  }
  // super_admin or unassigned (unassigned is already 403'd by middleware) —
  // leave multi-store handling to the controllers/super_admin path.
  return {
    ok: true,
    stores: normalizeStoreIds(
      req.body?.store ?? req.body?.storeId ?? req.query?.store
    )
  }
}

// Scalar-store convenience over authorizedStoreIds: returns the single store id
// an authorized write may target. For non-super-admin it is exactly req.storeId;
// for super_admin it is the client scalar (or null when absent). Rejects
// ambiguous/foreign/multi-store representations for non-super-admin.
const authorizedWriteStore = (req) => {
  if (req.user?.roleType !== 'super_admin') {
    const r = authorizedStoreIds(req)
    if (!r.ok || r.stores.length === 0) return { ok: false }
    return { ok: true, storeId: r.stores[0] }
  }
  const raw =
    req.body?.store !== undefined
      ? req.body.store
      : req.body?.storeId !== undefined
        ? req.body.storeId
        : req.query?.store
  const n = Number(raw)
  return {
    ok: true,
    storeId: raw === undefined || raw === null || raw === '' || !Number.isFinite(n)
      ? null
      : n
  }
}

const validateStoreAccess = (req, res, next) => {
  const userRole = req.user?.roleType
  const userStore = req.user?.store
  const supplied =
    req.query.store !== undefined
      ? req.query.store
      : req.body.store !== undefined
        ? req.body.store
        : req.body.storeId

  // Defense-in-depth: normalize WITHOUT parseInt coercion tricks. This closes
  // the latent array/JSON-string collapse gap (parseInt([own,foreign]) -> own,
  // parseInt('"[5]"') -> NaN) so a non-super-admin can never slip an ambiguous
  // multi-store representation past the middleware into a downstream controller.
  const requestedStores = normalizeStoreIds(supplied)
  const requestedStore = requestedStores[0] ?? null

  if (userRole === 'super_admin') {
    req.storeId = requestedStore
    return next()
  }

  // admin / kasir / user — always scoped to their own store.
  // If a store was supplied, EVERY represented store must equal the caller's
  // own store (a single-store tenant is authorized for exactly its own store).
  if (supplied !== undefined && supplied !== null && supplied !== '') {
    if (requestedStores.length === 0) {
      return res.status(403).json({
        message: 'Anda hanya dapat mengakses data di toko Anda'
      })
    }
    for (const c of requestedStores) {
      if (c !== Number(userStore)) {
        return res.status(403).json({
          message: 'Anda hanya dapat mengakses data di toko Anda'
        })
      }
    }
  }

  // N-11 (security): fail-closed for unassigned accounts. A non-super-admin
  // token without a numeric `store` claim used to fall through every
  // `req.storeId || req.cookies.store || req.user?.store` chain into the
  // attacker-controlled cookie/query value, silently granting cross-tenant
  // access. Require a real store claim up front so such accounts can never
  // reach tenant-scoped data under any client-supplied store.
  req.storeId = userStore
  if (!Number.isFinite(Number(userStore)) || Number(userStore) <= 0) {
    return res.status(403).json({
      message: 'Store assignment required'
    })
  }
  return next()
}

const validateStoreId = (storeId, userStore, userRole) => {
  if (userRole === 'super_admin') {
    return true
  }
  return parseInt(storeId) === userStore
}

module.exports = {
  validateStoreAccess,
  validateStoreId,
  normalizeStoreIds,
  authorizedStoreIds,
  authorizedWriteStore
}
