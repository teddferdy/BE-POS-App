'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// TDD RED: guarded test-only legacy user migration harness.
const db = require('../db/models')

const P = 'UMIG_'
let tenantA
let storeA1

beforeAll(async () => {
  tenantA = await db.tenant.create({ code: `${P}A_${Date.now()}`, name: `${P}Tenant A` })
  storeA1 = await db.location.create({ name: `${P}STORE_A1`, status: 'active', tenantId: tenantA.id })
}, 30000)

afterAll(async () => {
  await db.location.destroy({ where: { id: storeA1?.id }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: tenantA?.id }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 30000)

const mkUser = async (key, roleType, extra = {}) => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  return db.user.create({
    userName: `${P}${key}_${suffix}`,
    email: `${P}${key}_${suffix}@test.com`,
    roleType,
    status: 'active',
    password: 'Test12345',
    ...extra
  })
}

const cleanupUser = async (u) => {
  if (!u) return
  await db.storeAssignment.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
  await db.user.destroy({ where: { id: u.id }, force: true }).catch(() => {})
}

describe('apply-legacy-user-migration', () => {
  test('refuses production environment configuration', async () => {
    const { applyLegacyUserMigration } = require('../scripts/apply-legacy-user-migration')
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await expect(applyLegacyUserMigration({ db, users: [] })).rejects.toThrow(/production|refus/i)
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  test('migrates a valid single-store user with consistent membership + assignment', async () => {
    const { applyLegacyUserMigration } = require('../scripts/apply-legacy-user-migration')
    const u = await mkUser('adm', 'admin', { store: storeA1.id })
    try {
      const res = await applyLegacyUserMigration({ db, users: [u] })
      expect(res.migrated).toBe(1)
      const membership = await db.tenantMembership.findOne({ where: { userId: u.id, tenantId: tenantA.id } })
      expect(membership.role).toBe('store_admin')
      const assignment = await db.storeAssignment.findOne({ where: { userId: u.id, storeId: storeA1.id } })
      expect(Number(assignment.tenantId)).toBe(Number(tenantA.id))
    } finally {
      await cleanupUser(u)
    }
  })

  test('unresolved users fail closed and never write', async () => {
    const { applyLegacyUserMigration } = require('../scripts/apply-legacy-user-migration')
    const u = await mkUser('null', 'admin', { store: null })
    try {
      const res = await applyLegacyUserMigration({ db, users: [u] })
      expect(res.unresolved).toBe(1)
      expect(await db.tenantMembership.findOne({ where: { userId: u.id } })).toBeNull()
      await expect(applyLegacyUserMigration({ db, users: [u], failOnUnresolved: true })).rejects.toThrow()
    } finally {
      await cleanupUser(u)
    }
  })

  test('store-bound super_admin is never silently converted', async () => {
    const { applyLegacyUserMigration } = require('../scripts/apply-legacy-user-migration')
    const u = await mkUser('sup', 'super_admin', { store: storeA1.id })
    try {
      const res = await applyLegacyUserMigration({ db, users: [u] })
      expect(res.migrated).toBe(0)
      expect(res.superAdminReview).toBe(1)
      expect(await db.tenantMembership.findOne({ where: { userId: u.id } })).toBeNull()
    } finally {
      await cleanupUser(u)
    }
  })

  test('rerun is idempotent', async () => {
    const { applyLegacyUserMigration } = require('../scripts/apply-legacy-user-migration')
    const u = await mkUser('idem', 'kasir', { store: storeA1.id })
    try {
      const first = await applyLegacyUserMigration({ db, users: [u] })
      const second = await applyLegacyUserMigration({ db, users: [u] })
      expect(first.migrated).toBe(1)
      expect(second.migrated).toBe(0)
      expect(second.skipped).toBe(1)
      const count = await db.tenantMembership.count({ where: { userId: u.id } })
      expect(count).toBe(1)
    } finally {
      await cleanupUser(u)
    }
  })

  test('never uses JWT claims as migration authority', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../scripts/apply-legacy-user-migration.js'), 'utf8')
    expect(src).not.toMatch(/jsonwebtoken/)
    expect(src).not.toMatch(/req\.user/)
    expect(src).not.toMatch(/jwt\.verify/)
  })
})
