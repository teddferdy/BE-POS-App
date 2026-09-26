'use strict'

// TASK 2 — SUPER-01 read-only super_admin classifier.
//
// Never auto-converts. Store-bound super_admin must never become
// tenant_admin / store_admin / platform_admin implicitly. Returns explicit
// review evidence instead. Strictly non-mutating.
//
// Never calls: create / update / destroy / bulkCreate / bulkUpdate / raw SQL write.

const isDeleted = (row) => row != null && row.deletedAt != null && row.deletedAt !== ''
const isActiveStatus = (status) => String(status || '').toLowerCase() === 'active'

function classifyLegacySuperAdmin(account = {}) {
  const a = account && typeof account === 'object' ? account : {}
  const base = {
    accountId: a.id ?? null,
    legacyRoleType: a.roleType ?? null,
    classification: 'unresolved',
    autoConvertTo: null,
    grantsPlatformAuthority: false,
    evidence: {
      storeId: a.store ?? null,
      status: a.status ?? null,
      deletedAt: a.deletedAt ?? null
    },
    conflicts: []
  }
  if (a.roleType !== 'super_admin') {
    return { ...base, classification: 'not-applicable' }
  }
  if (isDeleted(a)) {
    return { ...base, conflicts: [{ code: 'DELETED_USER', field: 'deletedAt', message: 'account is deleted' }] }
  }
  if (!isActiveStatus(a.status)) {
    return { ...base, conflicts: [{ code: 'INACTIVE_USER', field: 'status', message: 'account is not active' }] }
  }
  if (a.store == null) {
    return {
      ...base,
      classification: 'global-review',
      evidence: { ...base.evidence, scope: 'global' },
      conflicts: [{ code: 'GLOBAL_SUPER_ADMIN_REVIEW', field: 'store', message: 'global super_admin requires human review before platform grant' }]
    }
  }
  return {
    ...base,
    classification: 'store-bound-review',
    evidence: { ...base.evidence, scope: 'store-bound' },
    conflicts: [{ code: 'STORE_BOUND_SUPER_ADMIN_REVIEW', field: 'store', message: `store-bound super_admin (store ${a.store}) must never auto-convert` }]
  }
}

module.exports = { classifyLegacySuperAdmin }
