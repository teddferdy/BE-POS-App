'use strict'

// TASK 2 — read-only legacy user migration planner (F4-02).
//
// Strictly non-mutating: reads approved mapping + current records, emits a
// proposed membership/assignment plan with conflict evidence. Never creates,
// updates, deletes, or infers final authority. Legacy role mapping is a
// CANDIDATE only (see utils/authContext LEGACY_ROLE_MAP narrow default).
//
// Never calls: create / update / destroy / bulkCreate / bulkUpdate / raw SQL write.

const LEGACY_CANDIDATE_MAP = Object.freeze({
  super_admin: null, // handled by SUPER-01 classifier, never here
  admin: 'store_admin',
  kasir: 'cashier',
  user: 'staff'
})

const KNOWN_LEGACY_ROLES = Object.freeze(['super_admin', 'admin', 'kasir', 'user'])

const conflict = (code, field, message) => ({ code, field, message })

const toPositiveInt = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

const isDeleted = (row) => row != null && row.deletedAt != null && row.deletedAt !== ''

const isActiveStatus = (status) => String(status || '').toLowerCase() === 'active'

function planLegacyUserConversion(user = {}, deps = {}) {
  const conflicts = []
  const u = user && typeof user === 'object' ? user : {}
  const storesById = deps.storesById && typeof deps.storesById === 'object' ? deps.storesById : {}
  const rolesById = deps.rolesById && typeof deps.rolesById === 'object' ? deps.rolesById : {}
  const historicalStoreIds = Array.isArray(deps.historicalStoreIds) ? deps.historicalStoreIds : []

  // Deleted / inactive short-circuit: no authority, no proposals.
  if (isDeleted(u)) {
    conflicts.push(conflict('DELETED_USER', 'deletedAt', 'user is deleted'))
    return emptyPlan(u, conflicts)
  }
  if (!isActiveStatus(u.status)) {
    conflicts.push(conflict('INACTIVE_USER', 'status', 'user is not active'))
    return emptyPlan(u, conflicts)
  }

  // super_admin is out of scope for this planner (SUPER-01 owns it).
  if (u.roleType === 'super_admin') {
    conflicts.push(conflict('SUPER_ADMIN_REVIEW', 'roleType', 'super_admin requires SUPER-01 classification'))
    return {
      userId: u.id ?? null,
      status: 'needs-review',
      candidateRole: null,
      candidateIsLegacyMapping: true,
      candidateTenantId: null,
      candidateStoreIds: [],
      proposedMemberships: [],
      proposedAssignments: [],
      conflicts,
      requiresReview: true
    }
  }

  if (!KNOWN_LEGACY_ROLES.includes(u.roleType)) {
    // Custom role string OR unknown role string: distinguish via role record.
    if (u.roleId != null && rolesById[u.roleId]) {
      conflicts.push(conflict('CUSTOM_ROLE', 'roleId', 'custom role requires review; legacy mapping is candidate only'))
    } else {
      conflicts.push(conflict('UNKNOWN_ROLE', 'roleType', `unknown roleType ${String(u.roleType)}`))
      return emptyPlan(u, conflicts)
    }
  }

  // roleId / roleType mismatch evidence (never blocks candidate, but flagged).
  if (u.roleId != null && rolesById[u.roleId] && rolesById[u.roleId].roleType !== u.roleType) {
    conflicts.push(conflict('ROLE_MISMATCH', 'roleId', `role record ${rolesById[u.roleId].roleType} mismatches user roleType ${u.roleType}`))
  }

  // Historical multi-store evidence.
  const history = [...new Set(historicalStoreIds.map(toPositiveInt).filter(Boolean))]
  if (history.length > 1) {
    conflicts.push(conflict('MULTI_STORE_HISTORY', 'store', 'historical multi-store user requires review'))
  }

  // Current store resolution.
  if (u.store == null) {
    conflicts.push(conflict('NULL_STORE', 'store', 'user has no store assignment'))
    return emptyPlan(u, conflicts)
  }
  const storeId = toPositiveInt(u.store)
  if (storeId == null) {
    conflicts.push(conflict('INVALID_STORE_ID', 'store', 'store must be a positive integer'))
    return emptyPlan(u, conflicts)
  }
  const store = storesById[storeId] || storesById[String(storeId)]
  if (!store) {
    conflicts.push(conflict('MISSING_STORE', 'store', `store ${storeId} does not exist`))
    return emptyPlan(u, conflicts)
  }
  if (isDeleted(store)) {
    conflicts.push(conflict('DELETED_STORE', 'store', `store ${storeId} is deleted`))
    return emptyPlan(u, conflicts)
  }
  const storeTenantId = store.tenantId == null ? null : toPositiveInt(store.tenantId)
  if (store.tenantId != null && storeTenantId == null) {
    conflicts.push(conflict('INVALID_STORE_TENANT', 'tenantId', `store ${storeId} has invalid tenantId`))
    return emptyPlan(u, conflicts)
  }
  if (storeTenantId == null) {
    conflicts.push(conflict('STORE_TENANT_UNRESOLVED', 'tenantId', `store ${storeId} has no approved tenant`))
    return emptyPlan(u, conflicts)
  }

  const candidateRole = LEGACY_CANDIDATE_MAP[u.roleType] || 'staff'
  const status = conflicts.length > 0 ? 'needs-review' : 'ready'
  const proposedMemberships = [{ userId: u.id ?? null, tenantId: storeTenantId, role: candidateRole, status: 'ACTIVE' }]
  const proposedAssignments =
    candidateRole === 'tenant_admin'
      ? []
      : [{ userId: u.id ?? null, tenantId: storeTenantId, storeId }]

  return {
    userId: u.id ?? null,
    status,
    candidateRole,
    candidateIsLegacyMapping: true,
    candidateTenantId: storeTenantId,
    candidateStoreIds: [storeId],
    proposedMemberships,
    proposedAssignments,
    conflicts,
    requiresReview: conflicts.length > 0
  }
}

function emptyPlan(u, conflicts) {
  return {
    userId: u != null && u.id != null ? u.id : null,
    status: conflicts.some((c) => c.code === 'MULTI_STORE_HISTORY' || c.code === 'CUSTOM_ROLE' || c.code === 'ROLE_MISMATCH' || c.code === 'SUPER_ADMIN_REVIEW')
      ? 'needs-review'
      : 'unresolved',
    candidateRole: null,
    candidateIsLegacyMapping: true,
    candidateTenantId: null,
    candidateStoreIds: [],
    proposedMemberships: [],
    proposedAssignments: [],
    conflicts,
    requiresReview: true
  }
}

module.exports = { planLegacyUserConversion, LEGACY_CANDIDATE_MAP }
