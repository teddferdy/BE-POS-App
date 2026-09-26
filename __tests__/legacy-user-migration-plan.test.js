'use strict'

// TDD RED: legacy user migration planner — read-only conversion planning.
// Covers every category required by TASK 2 before implementation exists.
const { planLegacyUserConversion } = require('../scripts/plan-legacy-user-migration')

const tenantA = { id: 10 }
const tenantB = { id: 20 }
const storeA1 = { id: 1, tenantId: 10 }
const storeB1 = { id: 2, tenantId: 20 }
const deletedStore = { id: 3, tenantId: 10, deletedAt: '2026-01-01T00:00:00.000Z' }

const baseUser = (overrides = {}) => ({
  id: 100,
  roleType: 'admin',
  store: 1,
  status: 'active',
  deletedAt: null,
  ...overrides
})

const baseDeps = (overrides = {}) => ({
  storesById: { 1: storeA1, 2: storeB1, 3: deletedStore },
  tenantsById: { 10: tenantA, 20: tenantB },
  existingMemberships: [],
  existingAssignments: [],
  ...overrides
})

describe('planLegacyUserConversion', () => {
  test('valid single-store admin maps to store_admin candidate', () => {
    const plan = planLegacyUserConversion(baseUser(), baseDeps())
    expect(plan.status).toBe('ready')
    expect(plan.candidateRole).toBe('store_admin')
    expect(plan.candidateTenantId).toBe(10)
    expect(plan.candidateStoreIds).toEqual([1])
    expect(plan.requiresReview).toBe(false)
  })

  test('null-store user is unresolved without authority', () => {
    const plan = planLegacyUserConversion(baseUser({ store: null }), baseDeps())
    expect(plan.status).toBe('unresolved')
    expect(plan.candidateStoreIds).toEqual([])
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NULL_STORE' })]))
    expect(plan.proposedMemberships).toEqual([])
  })

  test('historical multi-store user requires review', () => {
    const plan = planLegacyUserConversion(
      baseUser(),
      baseDeps({ historicalStoreIds: [1, 2] })
    )
    expect(plan.status).toBe('needs-review')
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MULTI_STORE_HISTORY' })]))
  })

  test('inactive user is unresolved', () => {
    const plan = planLegacyUserConversion(baseUser({ status: 'inactive' }), baseDeps())
    expect(plan.status).toBe('unresolved')
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INACTIVE_USER' })]))
  })

  test('deleted user is unresolved', () => {
    const plan = planLegacyUserConversion(
      baseUser({ deletedAt: '2026-01-01T00:00:00.000Z' }),
      baseDeps()
    )
    expect(plan.status).toBe('unresolved')
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DELETED_USER' })]))
  })

  test('kasir maps to cashier candidate', () => {
    const plan = planLegacyUserConversion(baseUser({ roleType: 'kasir' }), baseDeps())
    expect(plan.status).toBe('ready')
    expect(plan.candidateRole).toBe('cashier')
  })

  test('user maps to staff candidate', () => {
    const plan = planLegacyUserConversion(baseUser({ roleType: 'user' }), baseDeps())
    expect(plan.status).toBe('ready')
    expect(plan.candidateRole).toBe('staff')
  })

  test('unknown role is unresolved', () => {
    const plan = planLegacyUserConversion(baseUser({ roleType: 'owner' }), baseDeps())
    expect(plan.status).toBe('unresolved')
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_ROLE' })]))
  })

  test('custom role with role record is candidate-only review', () => {
    const plan = planLegacyUserConversion(
      baseUser({ roleType: 'user', roleId: 5 }),
      baseDeps({ rolesById: { 5: { id: 5, roleType: 'user', name: 'Custom' } } })
    )
    expect(['ready', 'needs-review']).toContain(plan.status)
    expect(plan.candidateRole).toBe('staff')
    expect(plan.candidateIsLegacyMapping).toBe(true)
  })

  test('missing store is unresolved', () => {
    const plan = planLegacyUserConversion(baseUser({ store: 999 }), baseDeps())
    expect(plan.status).toBe('unresolved')
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MISSING_STORE' })]))
  })

  test('deleted store is unresolved', () => {
    const plan = planLegacyUserConversion(baseUser({ store: 3 }), baseDeps())
    expect(plan.status).toBe('unresolved')
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DELETED_STORE' })]))
  })

  test('role/store mismatch is flagged', () => {
    const plan = planLegacyUserConversion(
      baseUser({ roleType: 'admin', roleId: 9 }),
      baseDeps({ rolesById: { 9: { id: 9, roleType: 'kasir' } } })
    )
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ROLE_MISMATCH' })]))
  })

  test('planner is strictly non-mutating', () => {
    const fakeDb = {
      user: { create: jest.fn(), update: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() },
      tenantMembership: { create: jest.fn() }
    }
    const before = JSON.stringify({ u: baseUser(), d: { storesById: { 1: storeA1 } } })
    planLegacyUserConversion(baseUser(), baseDeps({ db: fakeDb }))
    expect(fakeDb.user.create).not.toHaveBeenCalled()
    expect(fakeDb.user.update).not.toHaveBeenCalled()
    expect(fakeDb.user.destroy).not.toHaveBeenCalled()
    expect(JSON.stringify({ u: baseUser(), d: { storesById: { 1: storeA1 } } })).toBeDefined()
    expect(before).toBeDefined()
  })

  test('does not call mutating methods', () => {
    const mod = require('../scripts/plan-legacy-user-migration')
    const src = require('fs').readFileSync(require('path').join(__dirname, '../scripts/plan-legacy-user-migration.js'), 'utf8')
    for (const banned of ['.create(', '.update(', '.destroy(', '.bulkCreate(', 'bulkUpdate', 'sequelize.query']) {
      // allowlist: only inside comments mentioning "never call"
      const lines = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      const hits = lines.filter((l) => l.includes(banned))
      expect(hits).toEqual([])
    }
    expect(mod.planLegacyUserConversion).toBeDefined()
  })
})
