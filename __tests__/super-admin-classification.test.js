'use strict'

// TDD RED: SUPER-01 classification — store-bound super_admin never auto-converts.
const { classifyLegacySuperAdmin } = require('../scripts/plan-super-admin-classification')

describe('classifyLegacySuperAdmin', () => {
  test('global super_admin (store null) is global-review, never auto platform', () => {
    const result = classifyLegacySuperAdmin({ id: 1, roleType: 'super_admin', store: null, status: 'active' })
    expect(result.classification).toBe('global-review')
    expect(result.autoConvertTo).toBeNull()
    expect(result.grantsPlatformAuthority).toBe(false)
  })

  test('store-bound super_admin is store-bound-review with explicit evidence', () => {
    const result = classifyLegacySuperAdmin({ id: 2, roleType: 'super_admin', store: 7, status: 'active' })
    expect(result.classification).toBe('store-bound-review')
    expect(result.autoConvertTo).toBeNull()
    expect(result.grantsPlatformAuthority).toBe(false)
    expect(result.evidence.storeId).toBe(7)
  })

  test('store-bound super_admin never converts to tenant/store/platform admin', () => {
    for (const forbidden of ['tenant_admin', 'store_admin', 'platform_admin']) {
      const result = classifyLegacySuperAdmin({ id: 3, roleType: 'super_admin', store: 7, status: 'active' })
      expect(result.autoConvertTo).not.toBe(forbidden)
    }
  })

  test('non super_admin accounts are not classified', () => {
    expect(classifyLegacySuperAdmin({ id: 4, roleType: 'admin', store: 1, status: 'active' }).classification).toBe('not-applicable')
  })

  test('inactive super_admin is unresolved', () => {
    expect(classifyLegacySuperAdmin({ id: 5, roleType: 'super_admin', store: null, status: 'inactive' }).classification).toBe('unresolved')
  })

  test('deleted super_admin is unresolved', () => {
    const result = classifyLegacySuperAdmin({ id: 6, roleType: 'super_admin', store: null, status: 'active', deletedAt: '2026-01-01T00:00:00.000Z' })
    expect(result.classification).toBe('unresolved')
  })

  test('module never mutates', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../scripts/plan-super-admin-classification.js'), 'utf8')
    const lines = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    for (const banned of ['.create(', '.update(', '.destroy(', '.bulkCreate(']) {
      expect(lines.filter((l) => l.includes(banned))).toEqual([])
    }
  })
})
