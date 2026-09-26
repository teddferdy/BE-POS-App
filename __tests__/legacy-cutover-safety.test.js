'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-secret-key-for-auth-context'

// TDD RED: legacy cutover safety — no legacy signal independently authorizes.
const db = require('../db/models')
const { resolveAuthorizationContext } = require('../utils/authContext')

const P = 'CUT_'
let tenantA
let tenantB
let storeA1
let storeB1
let adminA

beforeAll(async () => {
  if (db.authorizationContextSession) await db.authorizationContextSession.sync().catch(() => {})
  tenantA = await db.tenant.create({ code: `${P}A_${Date.now()}`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B_${Date.now()}`, name: `${P}Tenant B` })
  storeA1 = await db.location.create({ name: `${P}STORE_A1`, status: 'active', tenantId: tenantA.id })
  storeB1 = await db.location.create({ name: `${P}STORE_B1`, status: 'active', tenantId: tenantB.id })
  const suffix = `${Date.now()}`
  adminA = await db.user.create({ userName: `${P}admin_${suffix}`, email: `${P}admin_${suffix}@test.com`, roleType: 'admin', status: 'active', password: 'Test12345' })
  await db.tenantMembership.create({ userId: adminA.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: adminA.id, tenantId: tenantA.id, storeId: storeA1.id })
}, 30000)

afterAll(async () => {
  await db.storeAssignment.destroy({ where: { userId: adminA?.id }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: adminA?.id }, force: true }).catch(() => {})
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.destroy({ where: {}, force: true }).catch(() => {})
  }
  await db.user.destroy({ where: { id: adminA?.id }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: [storeA1?.id, storeB1?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 30000)

const mockRes = () => {
  const res = {}
  res.statusCode = null
  res.body = null
  res.status = (c) => {
    res.statusCode = c
    return res
  }
  res.json = (b) => {
    res.body = b
    return res
  }
  return res
}

// A forged request carrying every legacy authority signal at once.
const forgedReq = (ctx) => ({
  authContext: ctx,
  user: { id: adminA.id, roleType: 'super_admin', store: storeB1.id },
  cookies: { store: `${storeB1.id}` },
  query: { storeId: `${storeB1.id}`, store: `${storeB1.id}` },
  body: { storeId: storeB1.id, store: storeB1.id },
  db
})

describe('legacy cutover safety', () => {
  test('legacy JWT role cannot authorize a foreign resource', async () => {
    const { requireCanonicalPermission } = require('../utils/authorization')
    const ctx = await resolveAuthorizationContext(db, { userId: adminA.id, activeTenantId: tenantA.id, activeStoreId: storeA1.id })
    const mw = requireCanonicalPermission('store.manage', () => ({ tenantId: tenantB.id, storeId: storeB1.id }))
    const res = mockRes()
    let next = false
    await mw(forgedReq(ctx), res, () => {
      next = true
    })
    expect(next).toBe(false)
    expect(res.statusCode).toBe(403)
  })

  test('legacy JWT store cannot authorize a foreign store', async () => {
    const { resolveCanonicalStoreScope } = require('../utils/storeValidation')
    const ctx = await resolveAuthorizationContext(db, { userId: adminA.id, activeTenantId: tenantA.id, activeStoreId: storeA1.id })
    const scope = resolveCanonicalStoreScope(forgedReq(ctx), [Number(storeB1.id)])
    expect(scope.ok).toBe(false)
  })

  test('legacy cookie cannot authorize', async () => {
    const { canonicalTenantFilter } = require('../utils/tenantScope')
    const ctx = await resolveAuthorizationContext(db, { userId: adminA.id, activeTenantId: tenantA.id, activeStoreId: storeA1.id })
    const where = canonicalTenantFilter(forgedReq(ctx), {})
    expect(JSON.stringify(where)).not.toContain(String(storeB1.id))
  })

  test('legacy query/body store cannot authorize', async () => {
    const { parseStoreCandidates, resolveCanonicalStoreScope } = require('../utils/storeValidation')
    const ctx = await resolveAuthorizationContext(db, { userId: adminA.id, activeTenantId: tenantA.id, activeStoreId: storeA1.id })
    const req = forgedReq(ctx)
    const scope = resolveCanonicalStoreScope(req, parseStoreCandidates(req).candidates)
    expect(scope.ok).toBe(false)
  })

  test('unresolved user cannot authorize', async () => {
    const { requireCanonicalPermission } = require('../utils/authorization')
    const mw = requireCanonicalPermission('store.manage', () => ({}))
    const res = mockRes()
    let next = false
    await mw({ user: { id: 99999999 }, cookies: {}, query: {}, body: {}, db }, res, () => {
      next = true
    })
    expect(next).toBe(false)
    expect([401, 403]).toContain(res.statusCode)
  })

  test('store-bound super_admin cannot become global', async () => {
    const bound = await db.user.create({
      userName: `${P}bound_${Date.now()}`,
      email: `${P}bound_${Date.now()}@test.com`,
      roleType: 'super_admin',
      store: storeA1.id,
      status: 'active',
      password: 'Test12345'
    })
    try {
      const ctx = await resolveAuthorizationContext(db, { userId: bound.id })
      expect(ctx.isPlatformAdmin).toBe(false)
      const { requireCanonicalPermission } = require('../utils/authorization')
      const mw = requireCanonicalPermission('tenant.manage', () => ({}))
      const res = mockRes()
      let next = false
      await mw({ authContext: ctx, user: { id: bound.id, roleType: 'super_admin' }, cookies: {}, query: {}, body: {}, db }, res, () => {
        next = true
      })
      expect(next).toBe(false)
    } finally {
      await db.user.destroy({ where: { id: bound.id }, force: true }).catch(() => {})
    }
  })

  test('membership revocation takes effect before JWT expiry', async () => {
    const mw = require('../utils/authorizationContextMiddleware')
    const session = await mw.createContextSession(db, { userId: adminA.id })
    await mw.switchSessionTenant(db, session.sessionId, adminA.id, tenantA.id)
    await db.tenantMembership.update({ status: 'DEACTIVATED' }, { where: { userId: adminA.id, tenantId: tenantA.id } })
    try {
      // A still-valid JWT + live session must not authorize after revocation.
      const ctx = await resolveAuthorizationContext(db, { userId: adminA.id, activeTenantId: tenantA.id })
      expect(ctx.activeTenantId).toBeNull()
      const { requireCanonicalPermission } = require('../utils/authorization')
      const gate = requireCanonicalPermission('store.manage', () => ({ tenantId: tenantA.id, storeId: storeA1.id }))
      const res = mockRes()
      let next = false
      await gate({ authContext: ctx, user: { id: adminA.id }, cookies: {}, query: {}, body: {}, db }, res, () => {
        next = true
      })
      expect(next).toBe(false)
    } finally {
      await db.tenantMembership.update({ status: 'ACTIVE' }, { where: { userId: adminA.id, tenantId: tenantA.id } })
    }
  })

  test('rollback cannot restore legacy privilege', async () => {
    // Even in a hypothetical "rollback" mode, canonical checks stay closed:
    // validateStoreAccess with a context never falls back to JWT authority,
    // and requireRole alone grants no canonical scope.
    const { validateStoreAccess } = require('../utils/storeValidation')
    const { canonicalResourceAccess } = require('../utils/tenantScope')
    const ctx = await resolveAuthorizationContext(db, { userId: adminA.id, activeTenantId: tenantA.id, activeStoreId: storeA1.id })
    const req = forgedReq(ctx)
    const res = mockRes()
    let next = false
    await validateStoreAccess(req, res, () => {
      next = true
    })
    // Canonical path must reject the forged foreign store, not pass through.
    expect(next).toBe(false)
    expect(res.statusCode).toBe(403)
    expect(canonicalResourceAccess(req, 'store.manage', { tenantId: tenantB.id, storeId: storeB1.id })).toBe(false)
  })
})
