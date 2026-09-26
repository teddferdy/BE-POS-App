'use strict'

// AUD-3 canonical audit authorization adapter.
//
// Translates the AUTH-1 canonical scope (`auditScopeFor`) into explicit
// Sequelize predicates and owns the audit permission gate + DENIED
// attribution. Authority comes ONLY from the resolved server-side context
// (`req.authContext`) and persisted ownership — never from JWT claims,
// cookies, query/body values, or frontend state.

const { Op } = require('sequelize')
const { auditScopeFor } = require('./authContext')

// Terminal store lifecycle states: audit history for these stores is hidden
// from tenant/store actors (fail closed). `inactive`/`draft`/operational
// history stays visible — deactivation alone must not destroy auditability.
// Soft-deleted stores are excluded by the paranoid roster query itself.
const TERMINAL_STORE_STATUSES = Object.freeze(['retired', 'quarantined'])

// Explicit deny predicate. Never `{}` (wildcard) for a no-scope result.
const denyPredicate = () => ({ id: { [Op.lt]: 0 } })

const toPositiveIntOrNull = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

// Current lifecycle-allowed roster for a tenant, from persisted
// `location.tenantId` only. Never inferred from request input.
const lifecycleAllowedStores = async (db, tenantId) => {
  const rows = await db.location.findAll({
    where: { tenantId, status: { [Op.notIn]: TERMINAL_STORE_STATUSES } },
    attributes: ['id']
  })
  return rows.map((r) => Number(r.id))
}

const storeList = (ids) => {
  const uniq = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
  if (uniq.length === 0) return null
  return uniq.length === 1 ? uniq[0] : { [Op.in]: uniq }
}

// Translate `auditScopeFor(context)` into an explicit Sequelize predicate.
//
//   platform {null,null}      => {} (unrestricted — canonical platform only)
//   tenant-wide {t,null}      => store IN current roster OR (store NULL AND tenantId = t)
//   store-scoped {t,[...]}    => store IN (assigned ∩ lifecycle roster)
//   null (no scope)           => explicit deny predicate (never {})
async function auditScopeWhere(db, ctx) {
  const scope = auditScopeFor(ctx)
  if (!scope) return denyPredicate()
  if (scope.tenantId == null && scope.storeIds == null) return {}
  if (scope.storeIds != null) {
    const allowed = await lifecycleAllowedStores(db, scope.tenantId)
    const ids = scope.storeIds.map(Number).filter((id) => allowed.includes(id))
    const fragment = storeList(ids)
    return fragment == null ? denyPredicate() : { store: fragment }
  }
  const roster = await lifecycleAllowedStores(db, scope.tenantId)
  const or = []
  const stores = storeList(roster)
  if (stores != null) or.push({ store: stores })
  // Tenant-attributed store-less rows (tenant-level events). Never matches
  // null-scope rows (tenantId NULL never equals the tenant).
  or.push({ store: null, tenantId: scope.tenantId })
  return { [Op.or]: or }
}

// Resolve a persisted audit row's ownership under locked historical semantics.
// The row's own tenantId wins when set; otherwise the store's CURRENT
// persisted tenant is used WITHOUT writing anything back. A row whose
// explicit tenantId conflicts with its store's current tenant fails closed.
// `store = null` rows are platform-only. Nothing here reads request input.
async function resolveAuditResourceOwnership(db, row) {
  const storeId = row?.store == null ? null : Number(row.store)
  if (storeId == null || !Number.isInteger(storeId)) {
    return { tenantId: row?.tenantId ?? null, storeId: null, conflict: false }
  }
  const loc = await db.location.findByPk(storeId, {
    attributes: ['id', 'tenantId'],
    paranoid: false
  })
  const storeTenant = loc && loc.tenantId != null ? Number(loc.tenantId) : null
  const rowTenant = row?.tenantId != null ? Number(row.tenantId) : null
  if (rowTenant != null && storeTenant != null && rowTenant !== storeTenant) {
    return { tenantId: null, storeId: storeId, conflict: true }
  }
  return { tenantId: rowTenant ?? storeTenant, storeId, conflict: false }
}

// Intersect an explicit business store filter with canonical scope. Returns
// the narrowed store id, or null when the candidate falls outside authority
// (caller must then return an empty safe result — never expand scope).
// Only explicit query/body candidates are accepted here; ambient cookie
// state is never a filter source.
async function narrowAuditStore(db, ctx, candidate) {
  const storeId = toPositiveIntOrNull(candidate)
  if (storeId == null) return null
  const scope = auditScopeFor(ctx)
  if (!scope) return null
  if (scope.tenantId == null && scope.storeIds == null) {
    const exists = await db.location.findByPk(storeId, { attributes: ['id'] })
    return exists ? storeId : null
  }
  if (scope.storeIds != null) {
    const allowed = await lifecycleAllowedStores(db, scope.tenantId)
    const ids = scope.storeIds.map(Number).filter((id) => allowed.includes(id))
    return ids.includes(storeId) ? storeId : null
  }
  const roster = await lifecycleAllowedStores(db, scope.tenantId)
  return roster.includes(storeId) ? storeId : null
}

// Canonical audit permission gate for the audit routes. Allows only contexts
// holding `audit.read` with a non-null canonical scope. Denials are 401 when
// identity/eligibility fails, 403 otherwise, each with a deterministic code,
// and authenticated denials record a DENIED audit-of-audit event attributed
// from canonical context (never from request values).
const requireAuditRead = async (req, res, next) => {
  const ctx = req?.authContext
  if (!ctx || ctx.eligible !== true) {
    if (req?.user?.id != null) await recordAuditDenial(req, ctx, 'INELIGIBLE_ACCOUNT')
    return res.status(401).json({ message: 'Unauthorized', code: 'INELIGIBLE_ACCOUNT' })
  }
  if (!ctx.permissions.includes('audit.read')) {
    await recordAuditDenial(req, ctx, 'MISSING_AUDIT_READ')
    return res.status(403).json({
      message: 'Akses Ditolak - Anda tidak memiliki izin',
      code: 'AUDIT_FORBIDDEN'
    })
  }
  if (!auditScopeFor(ctx)) {
    await recordAuditDenial(req, ctx, 'NO_AUDIT_SCOPE')
    return res.status(403).json({
      message: 'Akses Ditolak - Anda tidak memiliki izin',
      code: 'AUDIT_FORBIDDEN'
    })
  }
  return next()
}

// DENIED audit-of-audit attribution. Actor/scope come from the validated
// canonical context; request-derived values are never used. Fire-and-forget
// safe: failures never break the authorization response, and writes never
// re-enter the audit read path (no recursion).
async function recordAuditDenial(req, ctx, reason) {
  try {
    const { recordAudit, ACTOR_TYPES, AUDIT_RESULTS } = require('./auditLog')
    await recordAudit({
      actor: { type: ACTOR_TYPES.USER, id: req?.user?.id ?? null },
      action: 'ACCESS',
      entity: 'auditLog',
      entityId: null,
      description: `AUDIT_ACCESS_DENIED:${String(reason || 'FORBIDDEN')}`.slice(0, 200),
      tenantId: ctx?.activeTenantId ?? null,
      storeId: ctx?.activeStoreId ?? null,
      result: AUDIT_RESULTS.DENIED,
      reason: String(reason || 'FORBIDDEN').slice(0, 500),
      source: 'audit'
    })
  } catch {
    // Attribution must never break authorization responses.
  }
}

module.exports = {
  TERMINAL_STORE_STATUSES,
  denyPredicate,
  auditScopeWhere,
  resolveAuditResourceOwnership,
  narrowAuditStore,
  requireAuditRead,
  recordAuditDenial
}
