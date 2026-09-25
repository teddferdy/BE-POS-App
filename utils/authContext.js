'use strict'

// AUTH-1 (DR-01/DR-02/DR-12): canonical server-side authorization layer.
//
// Single coherent model — do NOT scatter `if (role === ...)` checks through
// controllers; resolve a context once via resolveAuthorizationContext() and
// decide via can(). Everything here is derived from persisted state (user,
// tenant_membership, store_assignment, location.tenantId) on every call, so
// stale/forged JWT claims can never escalate: the token only identifies the
// account (userId), never its authority.
//
// Chain: Authentication → Account eligibility → Tenant membership → Role →
// Permission → Store assignment → Resource ownership → ALLOW / DENY.
// Client-supplied tenant/store IDs are context *candidates*: the resolver
// validates them against persisted relationships and drops anything foreign.

const TARGET_ROLES = Object.freeze([
  'platform_admin',
  'tenant_admin',
  'store_admin',
  'cashier',
  'staff'
])

// DR-03 membership lifecycle vocabulary (exact).
const MEMBERSHIP_STATUS = Object.freeze(['ACTIVE', 'DEACTIVATED', 'RETIRED'])

// Legacy → target mapping. `admin` is AMBIGUOUS by design: existing `admin`
// rows carry no tenant/store-wide marker, so the fail-safe default is the
// NARROWER store_admin scope. Tenant-wide authority requires an explicit
// tenant_admin membership — it is never inferred from the legacy string.
// `super_admin` stays as a compatibility alias for platform_admin.
const LEGACY_ROLE_MAP = Object.freeze({
  super_admin: 'platform_admin',
  admin: 'store_admin',
  kasir: 'cashier',
  user: 'staff'
})

const legacyRoleTypeToTarget = (roleType) =>
  LEGACY_ROLE_MAP[roleType] || 'staff'

// Minimum coherent permission vocabulary (DR-12). Role baselines only;
// tenant-scoped custom roles are a documented future stage, not this task.
// platform_admin is NOT a bypass: it holds an explicit baseline like every
// other role, and cross-tenant reach applies only where the capability is
// platform-authorized (tenant.manage, backup.manage) or where visibility is
// explicitly platform-wide (audit.read with a tenant scope).
const PERMISSIONS = Object.freeze([
  'audit.read',
  'user.manage',
  'role.manage',
  'store.manage',
  'tenant.manage',
  'backup.manage'
])

const ROLE_BASELINE_PERMISSIONS = Object.freeze({
  platform_admin: [...PERMISSIONS],
  tenant_admin: ['audit.read', 'user.manage', 'role.manage', 'store.manage'],
  store_admin: ['audit.read'],
  cashier: [],
  staff: []
})

// Account eligibility: legacy statuses ('active'/'inactive') plus DR-03
// words, matched case-insensitively. Anything unrecognized is ineligible.
const isAccountEligible = (status) =>
  String(status || '').toUpperCase() === 'ACTIVE'

const toId = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Store-level confinement: these roles may only act within explicitly
// assigned stores. tenant_admin acts tenant-wide (assignment not required);
// platform_admin acts under platform capability.
const STORE_CONFINED_ROLES = Object.freeze(['store_admin', 'cashier', 'staff'])

const resolveAuthorizationContext = async (
  db,
  { userId, activeTenantId, activeStoreId } = {}
) => {
  const ctx = {
    accountId: toId(userId),
    accountStatus: null,
    eligible: false,
    memberships: [],
    activeTenantId: null,
    activeRole: null,
    permissions: [],
    assignedStoreIds: [],
    tenantStoreIds: [],
    activeStoreId: null,
    isPlatformAdmin: false,
    viaLegacyClaims: false,
    reason: null
  }

  if (!ctx.accountId) {
    ctx.reason = 'unknown-account'
    return ctx
  }

  const account = await db.user.findByPk(ctx.accountId, {
    attributes: ['id', 'status', 'roleType']
  })
  if (!account) {
    ctx.reason = 'unknown-account'
    return ctx
  }
  ctx.accountStatus = account.status
  if (!isAccountEligible(account.status)) {
    ctx.reason = 'ineligible-account'
    return ctx
  }
  ctx.eligible = true

  const legacyTarget = legacyRoleTypeToTarget(account.roleType)
  const legacyIsPlatform = legacyTarget === 'platform_admin'

  const memberships = await db.tenantMembership.findAll({
    where: { userId: ctx.accountId },
    include: [
      {
        model: db.tenant,
        as: 'tenant',
        attributes: ['id', 'status'],
        required: false
      }
    ]
  })
  ctx.memberships = memberships.map((m) => ({
    tenantId: m.tenantId,
    role: m.role,
    status: m.status
  }))

  // Effective = ACTIVE membership on an ACTIVE (non-suspended) tenant.
  const effective = memberships.filter(
    (m) => m.status === 'ACTIVE' && (!m.tenant || m.tenant.status === 'active')
  )
  const effectiveTenantIds = new Set(effective.map((m) => m.tenantId))

  if (effective.some((m) => m.role === 'platform_admin') || legacyIsPlatform) {
    ctx.isPlatformAdmin = true
  }

  // Active tenant: requested must be effective; unrequested defaults only
  // when the actor has exactly one effective membership (server-derived,
  // never client-invented). Platform actors may also operate tenant-less.
  const requestedTenant = toId(activeTenantId)
  if (requestedTenant != null) {
    if (!effectiveTenantIds.has(requestedTenant)) {
      ctx.reason = 'foreign-or-inactive-tenant'
      return finalizePlatformFallback(ctx, legacyIsPlatform)
    }
    ctx.activeTenantId = requestedTenant
  } else if (effective.length === 1) {
    ctx.activeTenantId = effective[0].tenantId
  }

  const activeMembership = effective.find((m) => m.tenantId === ctx.activeTenantId)
  if (activeMembership) {
    ctx.activeRole = activeMembership.role
    ctx.permissions = [...(ROLE_BASELINE_PERMISSIONS[activeMembership.role] || [])]
  } else if (ctx.isPlatformAdmin) {
    // Platform context without a tenant membership: explicit baseline, and
    // flagged as legacy-derived when it comes from the old roleType string.
    ctx.activeRole = 'platform_admin'
    ctx.permissions = [...ROLE_BASELINE_PERMISSIONS.platform_admin]
    ctx.viaLegacyClaims = legacyIsPlatform && !effective.some((m) => m.role === 'platform_admin')
  }

  // Effective assignments: only under an effective membership (DR-03 —
  // deactivation invalidates assignments without deleting them).
  if (effective.length > 0) {
    const assignments = await db.storeAssignment.findAll({
      where: { userId: ctx.accountId },
      attributes: ['storeId', 'tenantId']
    })
    ctx.assignedStoreIds = assignments
      .filter((a) => effectiveTenantIds.has(Number(a.tenantId)))
      .map((a) => Number(a.storeId))
  }

  // Tenant store roster for scope checks (active tenant only).
  if (ctx.activeTenantId != null) {
    const stores = await db.location.findAll({
      where: { tenantId: ctx.activeTenantId },
      attributes: ['id']
    })
    ctx.tenantStoreIds = stores.map((s) => Number(s.id))
  }

  // Active store: must belong to the active tenant AND satisfy assignment
  // rules for the active role. Anything foreign → null (denied selection).
  const requestedStore = toId(activeStoreId)
  if (requestedStore != null) {
    const inTenant =
      ctx.activeTenantId != null && ctx.tenantStoreIds.includes(requestedStore)
    const platformWide = ctx.isPlatformAdmin && ctx.activeTenantId == null
    if (!inTenant && !platformWide) {
      ctx.reason = 'foreign-store'
      return ctx
    }
    if (
      inTenant &&
      STORE_CONFINED_ROLES.includes(ctx.activeRole) &&
      !ctx.assignedStoreIds.includes(requestedStore)
    ) {
      ctx.reason = 'unassigned-store'
      return ctx
    }
    ctx.activeStoreId = requestedStore
  }

  return ctx
}

// Platform fallback keeps cross-tenant platform capability usable when no
// tenant membership authorizes the request, without granting tenant scope.
const finalizePlatformFallback = (ctx, legacyIsPlatform) => {
  if (ctx.isPlatformAdmin) {
    ctx.activeRole = 'platform_admin'
    ctx.permissions = [...ROLE_BASELINE_PERMISSIONS.platform_admin]
    ctx.viaLegacyClaims = legacyIsPlatform
  }
  return ctx
}

// Pure synchronous decision on a resolved context. Scope is matched against
// server-resolved sets only — caller-supplied IDs outside the context can
// never satisfy it.
const can = (ctx, permission, scope = {}) => {
  if (!ctx || ctx.eligible !== true) return false
  if (!PERMISSIONS.includes(permission)) return false
  if (!ctx.permissions.includes(permission)) return false

  const tenantId = scope.tenantId != null ? toId(scope.tenantId) : null
  const storeId = scope.storeId != null ? toId(scope.storeId) : null

  // Platform capability: platform-level permissions need no tenant scope;
  // scoped reads are allowed cross-tenant (that IS the platform capability),
  // constrained to the active tenant when one is selected.
  if (ctx.isPlatformAdmin) {
    if (permission === 'tenant.manage' || permission === 'backup.manage') return true
    if (tenantId != null && ctx.activeTenantId != null && tenantId !== ctx.activeTenantId) return false
    if (storeId != null && ctx.activeTenantId != null && !ctx.tenantStoreIds.includes(storeId)) return false
    return true
  }

  // Non-platform actors require an effective tenant context for any decision.
  if (ctx.activeTenantId == null) return false
  if (tenantId != null && tenantId !== ctx.activeTenantId) return false
  if (storeId != null && !ctx.tenantStoreIds.includes(storeId)) return false

  // Store-confined roles must name an assigned store for resource decisions —
  // a tenant-wide grant can never flow from a store_admin context.
  if (STORE_CONFINED_ROLES.includes(ctx.activeRole)) {
    if (storeId == null) return false
    if (!ctx.assignedStoreIds.includes(storeId)) return false
  }

  return true
}

// AUD-3 readiness: derive the tenant-aware audit visibility scope from a
// resolved context. storeIds === null means tenant-wide; null return means
// no audit visibility at all. (Wiring this into the audit controller is
// AUD-3 follow-up, not AUTH-1.)
const auditScopeFor = (ctx) => {
  if (!ctx || ctx.eligible !== true) return null
  if (!ctx.permissions.includes('audit.read')) return null
  if (ctx.isPlatformAdmin && ctx.activeTenantId == null) {
    return { tenantId: null, storeIds: null }
  }
  if (ctx.activeTenantId == null) return null
  if (STORE_CONFINED_ROLES.includes(ctx.activeRole)) {
    return { tenantId: ctx.activeTenantId, storeIds: [...ctx.assignedStoreIds] }
  }
  return { tenantId: ctx.activeTenantId, storeIds: null }
}

module.exports = {
  TARGET_ROLES,
  MEMBERSHIP_STATUS,
  LEGACY_ROLE_MAP,
  PERMISSIONS,
  ROLE_BASELINE_PERMISSIONS,
  legacyRoleTypeToTarget,
  resolveAuthorizationContext,
  can,
  auditScopeFor
}
