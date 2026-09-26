'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// TDD RED: guarded test-only tenant foundation migration harness.
const db = require('../db/models')

const P = 'TMIG_'
const artifactRow = (overrides = {}) => ({
  source: 'migration-review',
  reviewer: 'reviewer@test.com',
  approval: 'approved',
  effectiveAt: '2026-09-25T00:00:00.000Z',
  ...overrides
})

let tenantA
let tenantB
let storeNull
let storeA

beforeAll(async () => {
  tenantA = await db.tenant.create({ code: `${P}A_${Date.now()}`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B_${Date.now()}`, name: `${P}Tenant B` })
  storeNull = await db.location.create({ name: `${P}STORE_NULL`, status: 'draft', tenantId: null })
  storeA = await db.location.create({ name: `${P}STORE_A`, status: 'active', tenantId: tenantA.id })
}, 30000)

afterAll(async () => {
  await db.location.destroy({ where: { id: [storeNull?.id, storeA?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 30000)

describe('apply-tenant-foundation-migration', () => {
  test('refuses production environment configuration', async () => {
    const { applyTenantFoundationMigration } = require('../scripts/apply-tenant-foundation-migration')
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await expect(
        applyTenantFoundationMigration({ db, mappingRows: [] })
      ).rejects.toThrow(/production|refus/i)
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  test('refuses a remote production-adjacent DATABASE_URL', async () => {
    const { applyTenantFoundationMigration } = require('../scripts/apply-tenant-foundation-migration')
    const prev = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgres://user:pass@prod.example.com:5432/cashier_app'
    try {
      await expect(
        applyTenantFoundationMigration({ db, mappingRows: [artifactRow({ storeId: 1, disposition: 'GLOBAL' })] })
      ).rejects.toThrow(/production-adjacent|REFUSED/i)
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prev
    }
  })

  test('requires an approved mapping artifact and runs preflight first', async () => {
    const { applyTenantFoundationMigration } = require('../scripts/apply-tenant-foundation-migration')
    await expect(applyTenantFoundationMigration({ db, mappingRows: [] })).rejects.toThrow()
    await expect(
      applyTenantFoundationMigration({
        db,
        mappingRows: [artifactRow({ storeId: storeNull.id, disposition: 'MAP', tenantId: null })]
      })
    ).rejects.toThrow(/MAP_TENANT_REQUIRED|preflight|valid/i)
    // Failed preflight wrote nothing.
    const fresh = await db.location.findByPk(storeNull.id)
    expect(fresh.tenantId).toBeNull()
  })

  test('MAP converts a tenantless store; rerun is idempotent', async () => {
    const { applyTenantFoundationMigration } = require('../scripts/apply-tenant-foundation-migration')
    const rows = [artifactRow({ storeId: storeNull.id, disposition: 'MAP', tenantId: tenantA.id })]
    const first = await applyTenantFoundationMigration({ db, mappingRows: rows })
    expect(first.applied).toBe(1)
    expect((await db.location.findByPk(storeNull.id)).tenantId).toBe(tenantA.id)
    const second = await applyTenantFoundationMigration({ db, mappingRows: rows })
    expect(second.applied).toBe(0)
    expect(second.skipped).toBe(1)
  })

  test('QUARANTINE grants zero operational authority', async () => {
    const { applyTenantFoundationMigration } = require('../scripts/apply-tenant-foundation-migration')
    const q = await db.location.create({ name: `${P}Q`, status: 'active', tenantId: tenantA.id })
    try {
      const res = await applyTenantFoundationMigration({
        db,
        mappingRows: [artifactRow({ storeId: q.id, disposition: 'QUARANTINE', tenantId: null })]
      })
      expect(res.quarantined).toBe(1)
      expect((await db.location.findByPk(q.id)).status).toBe('quarantined')
    } finally {
      await db.location.destroy({ where: { id: q.id }, force: true }).catch(() => {})
    }
  })

  test('GLOBAL is explicit-only and RETIRE denies operations', async () => {
    const { applyTenantFoundationMigration } = require('../scripts/apply-tenant-foundation-migration')
    const g = await applyTenantFoundationMigration({
      db,
      mappingRows: [artifactRow({ storeId: storeA.id, disposition: 'GLOBAL', tenantId: null })]
    })
    expect(g.global).toBe(1)
    const r = await db.location.create({ name: `${P}R`, status: 'active', tenantId: tenantA.id })
    try {
      const res = await applyTenantFoundationMigration({
        db,
        mappingRows: [artifactRow({ storeId: r.id, disposition: 'RETIRE', tenantId: null })]
      })
      expect(res.retired).toBe(1)
      expect((await db.location.findByPk(r.id)).status).toBe('retired')
    } finally {
      await db.location.destroy({ where: { id: r.id }, force: true }).catch(() => {})
    }
  })

  test('partial failure records evidence and supports rollback', async () => {
    const { applyTenantFoundationMigration, rollbackTenantFoundationMigration } = require('../scripts/apply-tenant-foundation-migration')
    const s1 = await db.location.create({ name: `${P}P1`, status: 'draft', tenantId: null })
    const s2 = await db.location.create({ name: `${P}P2`, status: 'draft', tenantId: null })
    try {
      // Both rows pass preflight (shape + store match); the second fails at
      // apply time (tenant 99999999 is not approved), exercising
      // continueOnError evidence + rollback of the first row.
      const res = await applyTenantFoundationMigration({
        db,
        mappingRows: [
          artifactRow({ storeId: s1.id, disposition: 'MAP', tenantId: tenantA.id }),
          artifactRow({ storeId: s2.id, disposition: 'MAP', tenantId: 99999999 })
        ],
        continueOnError: true
      })
      expect(res.applied).toBe(1)
      expect(res.errors.length).toBeGreaterThan(0)
      const rolled = await rollbackTenantFoundationMigration({ db, evidence: res })
      expect(rolled.reverted).toBeGreaterThanOrEqual(1)
      expect((await db.location.findByPk(s1.id)).tenantId).toBeNull()
    } finally {
      await db.location.destroy({ where: { id: [s1.id, s2.id] }, force: true }).catch(() => {})
    }
  })

  test('never uses JWT claims as migration authority', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../scripts/apply-tenant-foundation-migration.js'), 'utf8')
    expect(src).not.toMatch(/jsonwebtoken/)
    expect(src).not.toMatch(/req\.user/)
    expect(src).not.toMatch(/jwt\.verify/)
  })
})
