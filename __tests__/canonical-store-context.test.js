'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-secret-key-for-auth-context'

// TDD RED: canonical store/tenant context — client values are candidates only,
// authority comes from req.authContext + persisted ownership.
const db = require('../db/models')
const {
  resolveAuthorizationContext,
  can,
  canAccessResource
} = require('../utils/authContext')

const P = 'CANON_'
let tenantA
let tenantB
let storeA1
let storeA2
let storeB1
let adminA
let cashierA

beforeAll(async () => {
  if (db.authorizationContextSession) await db.authorizationContextSession.sync().catch(() => {})
  tenantA = await db.tenant.create({ code: `${P}A_${Date.now()}`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B_${Date.now()}`, name: `${P}Tenant B` })
  storeA1 = await db.location.create({ name: `${P}STORE_A1`, status: 'active', tenantId: tenantA.id })
  storeA2 = await db.location.create({ name: `${P}STORE_A2`, status: 'active', tenantId: tenantA.id })
  storeB1 = await db.location.create({ name: `${P}STORE_B1`, status: 'active', tenantId: tenantB.id })
  const suffix = `${Date.now()}`
  adminA = await db.user.create({ userName: `${P}admin_${suffix}`, email: `${P}admin_${suffix}@test.com`, roleType: 'admin', status: 'active', password: 'Test12345' })
  cashierA = await db.user.create({ userName: `${P}kasir_${suffix}`, email: `${P}kasir_${suffix}@test.com`, roleType: 'kasir', status: 'active', password: 'Test12345' })
  await db.tenantMembership.create({ userId: adminA.id, tenantId: tenantA.id, role: 'tenant_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: cashierA.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: cashierA.id, tenantId: tenantA.id, storeId: storeA1.id })
}, 30000)

afterAll(async () => {
  for (const u of [adminA, cashierA]) {
    if (!u) continue
    await db.storeAssignment.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
    await db.tenantMembership.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
  }
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.destroy({ where: {}, force: true }).catch(() => {})
  }
  await db.user.destroy({ where: { id: [adminA?.id, cashierA?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: [storeA1?.id, storeA2?.id, storeB1?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 30000)

const ctxFor = (userId, activeTenantId, activeStoreId) =>
  resolveAuthorizationContext(db, { userId, activeTenantId, activeStoreId })

describe('canonical store context', () => {
  test('storeValidation exposes candidate parsing without granting authority', () => {
    const sv = require('../utils/storeValidation')
    expect(typeof sv.parseStoreCandidates).toBe('function')
    // Pure normalization: forged cookie/query values parse to numbers but
    // the parse result itself carries no allow/deny verdict.
    const parsed = sv.parseStoreCandidates({ query: { store: `${storeB1.id}` }, body: {}, cookies: { store: `${storeB1.id}` } })
    expect(parsed.candidates).toContain(Number(storeB1.id))
    expect(parsed.verdict).toBeUndefined()
    expect(typeof sv.resolveCanonicalStoreScope).toBe('function')
  })

  test('valid active store resolves for tenant_admin within own tenant', async () => {
    const sv = require('../utils/storeValidation')
    const ctx = await ctxFor(adminA.id, tenantA.id, storeA1.id)
    const req = { authContext: ctx, query: {}, body: {}, cookies: {} }
    const scope = sv.resolveCanonicalStoreScope(req, [Number(storeA1.id)])
    expect(scope.ok).toBe(true)
    expect(scope.stores).toEqual([Number(storeA1.id)])
  })

  test('foreign store is rejected even when client sends it everywhere', async () => {
    const sv = require('../utils/storeValidation')
    const ctx = await ctxFor(adminA.id, tenantA.id, storeA1.id)
    const req = {
      authContext: ctx,
      query: { store: `${storeB1.id}` },
      body: { store: storeB1.id, storeId: storeB1.id },
      cookies: { store: `${storeB1.id}` }
    }
    const scope = sv.resolveCanonicalStoreScope(req, sv.parseStoreCandidates(req).candidates)
    expect(scope.ok).toBe(false)
    expect(scope.code).toMatch(/FOREIGN|MISMATCH/)
  })

  test('unassigned store is rejected for cashier', async () => {
    const sv = require('../utils/storeValidation')
    const ctx = await ctxFor(cashierA.id, tenantA.id, storeA1.id)
    const req = { authContext: ctx, query: {}, body: {}, cookies: {} }
    const scope = sv.resolveCanonicalStoreScope(req, [Number(storeA2.id)])
    expect(scope.ok).toBe(false)
    expect(scope.code).toMatch(/ASSIGN/)
  })

  test('nonexistent store is rejected', async () => {
    const sv = require('../utils/storeValidation')
    const ctx = await ctxFor(adminA.id, tenantA.id, null)
    const req = { authContext: ctx, query: {}, body: {}, cookies: {} }
    expect(sv.resolveCanonicalStoreScope(req, [99999999]).ok).toBe(false)
  })

  test('tenant/store mismatch fails closed', async () => {
    const ctx = await ctxFor(adminA.id, tenantA.id, null)
    // Resource owned by tenant B checked under tenant A context denies.
    expect(canAccessResource(ctx, 'store.manage', { tenantId: tenantB.id, storeId: storeB1.id })).toBe(false)
  })

  test('tenantScope consumes canonical context, not JWT claims', async () => {
    const ts = require('../utils/tenantScope')
    expect(typeof ts.canonicalTenantFilter).toBe('function')
    const ctx = await ctxFor(cashierA.id, tenantA.id, storeA1.id)
    // Forged JWT-style claims on req.user must not widen the filter.
    const req = { authContext: ctx, user: { roleType: 'super_admin', store: storeB1.id }, cookies: { store: `${storeB1.id}` } }
    const where = ts.canonicalTenantFilter(req, {})
    expect(JSON.stringify(where)).not.toContain(String(storeB1.id))
  })

  test('unauthorized multi-store request is rejected, not partially applied', async () => {
    const sv = require('../utils/storeValidation')
    const ctx = await ctxFor(cashierA.id, tenantA.id, storeA1.id)
    const req = { authContext: ctx, query: {}, body: {}, cookies: {} }
    const scope = sv.resolveCanonicalStoreScope(req, [Number(storeA1.id), Number(storeA2.id)])
    expect(scope.ok).toBe(false)
  })

  test('stale frontend activeStore cookie cannot authorize', async () => {
    const sv = require('../utils/storeValidation')
    const ctx = await ctxFor(cashierA.id, tenantA.id, storeA1.id)
    // Cookie names a foreign store; canonical selection stays pinned.
    const req = { authContext: ctx, query: {}, body: {}, cookies: { store: `${storeB1.id}`, activeStore: `${storeB1.id}` } }
    const scope = sv.resolveCanonicalStoreScope(req, sv.parseStoreCandidates(req).candidates)
    expect(scope.ok).toBe(false)
  })

  test('platform capability stays distinct from tenant authority', async () => {
    const ctx = await ctxFor(adminA.id, tenantA.id, null)
    expect(ctx.isPlatformAdmin).toBe(false)
    expect(can(ctx, 'tenant.manage', {})).toBe(false)
  })
})
