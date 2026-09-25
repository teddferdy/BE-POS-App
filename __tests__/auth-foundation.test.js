process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// AUTH-1 (DR-01/DR-02/DR-12 authorization foundation) tests.
// Proves the tenant entity, membership, store assignment, role vocabulary,
// permission baselines, and server-side authorization context against the
// isolated test database (jest globalSetup). Fixtures use the AUTH_T_ prefix
// and are removed in afterAll. Never touches real data.
const db = require('../db/models')
const {
  TARGET_ROLES,
  MEMBERSHIP_STATUS,
  LEGACY_ROLE_MAP,
  ROLE_BASELINE_PERMISSIONS,
  legacyRoleTypeToTarget,
  resolveAuthorizationContext,
  can
} = require('../utils/authContext')

const P = 'AUTH_T_'

let tenantA = null
let tenantB = null
let storeA1 = null
let storeA2 = null
let storeB1 = null
let userMulti = null
let userInactive = null
let userPlain = null
let legacySuper = null

beforeAll(async () => {
  tenantA = await db.tenant.create({ code: `${P}A`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B`, name: `${P}Tenant B` })

  storeA1 = await db.location.create({ name: `${P}STORE_A1`, status: 'active', tenantId: tenantA.id })
  storeA2 = await db.location.create({ name: `${P}STORE_A2`, status: 'active', tenantId: tenantA.id })
  storeB1 = await db.location.create({ name: `${P}STORE_B1`, status: 'active', tenantId: tenantB.id })

  userMulti = await db.user.create({
    userName: `${P}multi`,
    email: `${P}multi@test.com`,
    roleType: 'user',
    status: 'active',
    password: 'Test12345'
  })
  userInactive = await db.user.create({
    userName: `${P}inactive`,
    email: `${P}inactive@test.com`,
    roleType: 'user',
    status: 'active',
    password: 'Test12345'
  })
  userPlain = await db.user.create({
    userName: `${P}plain`,
    email: `${P}plain@test.com`,
    roleType: 'kasir',
    status: 'active',
    password: 'Test12345'
  })
  legacySuper = await db.user.create({
    userName: `${P}legacy_super`,
    email: `${P}legacy_super@test.com`,
    roleType: 'super_admin',
    status: 'active',
    password: 'Test12345'
  })

  // Same user, different roles per tenant.
  await db.tenantMembership.create({ userId: userMulti.id, tenantId: tenantA.id, role: 'tenant_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: userMulti.id, tenantId: tenantB.id, role: 'store_admin', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: userMulti.id, tenantId: tenantB.id, storeId: storeB1.id })
  // Inactive membership with a (preserved) assignment.
  await db.tenantMembership.create({ userId: userInactive.id, tenantId: tenantA.id, role: 'store_admin', status: 'DEACTIVATED' })
  await db.storeAssignment.create({ userId: userInactive.id, tenantId: tenantA.id, storeId: storeA1.id })
})

afterAll(async () => {
  await db.storeAssignment.destroy({ where: { tenantId: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true })
  await db.tenantMembership.destroy({ where: { tenantId: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true })
  await db.location.destroy({ where: { id: [storeA1?.id, storeA2?.id, storeB1?.id].filter(Boolean) }, force: true })
  await db.user.destroy({
    where: { id: [userMulti?.id, userInactive?.id, userPlain?.id, legacySuper?.id].filter(Boolean) },
    force: true
  })
  await db.tenant.destroy({ where: { id: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true })
  await db.sequelize.close()
})

describe('AUTH-1 tenant entity', () => {
  test('tenant code is unique', async () => {
    await expect(db.tenant.create({ code: `${P}A`, name: 'dup' })).rejects.toThrow()
  })

  test('store belongs to exactly one tenant', async () => {
    const fresh = await db.location.findByPk(storeA1.id)
    expect(fresh.tenantId).toBe(tenantA.id)
  })

  test('cross-tenant store assignment is rejected', async () => {
    // storeA1 belongs to tenantA; assigning it under tenantB must fail.
    await expect(
      db.storeAssignment.create({ userId: userMulti.id, tenantId: tenantB.id, storeId: storeA1.id })
    ).rejects.toThrow(/tenant/i)
  })
})

describe('AUTH-1 membership', () => {
  test('one user can belong to multiple tenants with different roles', async () => {
    const ctxA = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantA.id })
    const ctxB = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantB.id })
    expect(ctxA.eligible).toBe(true)
    expect(ctxA.activeRole).toBe('tenant_admin')
    expect(ctxB.activeRole).toBe('store_admin')
  })

  test('membership user+tenant is unique', async () => {
    await expect(
      db.tenantMembership.create({ userId: userMulti.id, tenantId: tenantA.id, role: 'staff', status: 'ACTIVE' })
    ).rejects.toThrow()
  })

  test('DEACTIVATED membership authorizes nothing (assignment preserved but ineffective)', async () => {
    const ctx = await resolveAuthorizationContext(db, { userId: userInactive.id, activeTenantId: tenantA.id })
    expect(ctx.eligible).toBe(true)
    expect(ctx.activeTenantId).toBeNull()
    expect(can(ctx, 'audit.read', { tenantId: tenantA.id, storeId: storeA1.id })).toBe(false)
    // Assignment row itself is preserved (DR-03).
    const kept = await db.storeAssignment.findOne({ where: { userId: userInactive.id, storeId: storeA1.id } })
    expect(kept).not.toBeNull()
  })

  test('RETIRED membership authorizes nothing', async () => {
    const m = await db.tenantMembership.findOne({ where: { userId: userInactive.id, tenantId: tenantA.id } })
    await m.update({ status: 'RETIRED' })
    const ctx = await resolveAuthorizationContext(db, { userId: userInactive.id, activeTenantId: tenantA.id })
    expect(ctx.activeTenantId).toBeNull()
    await m.update({ status: 'DEACTIVATED' })
  })
})

describe('AUTH-1 store assignment', () => {
  test('assigned store is allowed for store_admin', async () => {
    const ctx = await resolveAuthorizationContext(db, {
      userId: userMulti.id,
      activeTenantId: tenantB.id,
      activeStoreId: storeB1.id
    })
    expect(ctx.activeStoreId).toBe(storeB1.id)
  })

  test('unassigned store in the same tenant is denied for store_admin', async () => {
    const other = await db.location.create({ name: `${P}STORE_B2`, status: 'active', tenantId: tenantB.id })
    try {
      const ctx = await resolveAuthorizationContext(db, {
        userId: userMulti.id,
        activeTenantId: tenantB.id,
        activeStoreId: other.id
      })
      expect(ctx.activeStoreId).toBeNull()
    } finally {
      await db.location.destroy({ where: { id: other.id }, force: true })
    }
  })

  test('tenant_admin may resolve any store within its tenant without assignment', async () => {
    const ctx = await resolveAuthorizationContext(db, {
      userId: userMulti.id,
      activeTenantId: tenantA.id,
      activeStoreId: storeA2.id
    })
    expect(ctx.activeStoreId).toBe(storeA2.id)
  })

  test('active store must belong to the active tenant', async () => {
    const ctx = await resolveAuthorizationContext(db, {
      userId: userMulti.id,
      activeTenantId: tenantA.id,
      activeStoreId: storeB1.id
    })
    expect(ctx.activeStoreId).toBeNull()
  })
})

describe('AUTH-1 roles & permissions', () => {
  test('target vocabulary is exposed and legacy mapping is explicit', async () => {
    expect(TARGET_ROLES).toEqual(expect.arrayContaining(['platform_admin', 'tenant_admin', 'store_admin', 'cashier', 'staff']))
    expect(LEGACY_ROLE_MAP.super_admin).toBe('platform_admin')
    expect(LEGACY_ROLE_MAP.kasir).toBe('cashier')
    expect(LEGACY_ROLE_MAP.user).toBe('staff')
    // admin is ambiguous by design — never silently widened.
    expect(LEGACY_ROLE_MAP.admin).toBe('store_admin')
    expect(legacyRoleTypeToTarget('admin')).toBe('store_admin')
  })

  test('tenant_admin has audit.read in-tenant, not platform permissions', async () => {
    const ctx = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantA.id })
    expect(can(ctx, 'audit.read', { tenantId: tenantA.id })).toBe(true)
    expect(can(ctx, 'tenant.manage', {})).toBe(false)
    expect(can(ctx, 'backup.manage', {})).toBe(false)
  })

  test('sensitive permission does not cross tenant scope', async () => {
    const ctx = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantA.id })
    expect(can(ctx, 'audit.read', { tenantId: tenantB.id })).toBe(false)
    expect(can(ctx, 'user.manage', { tenantId: tenantB.id })).toBe(false)
  })

  test('tenant_admin cannot escalate to platform_admin', async () => {
    const ctx = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantA.id })
    expect(ctx.isPlatformAdmin).toBe(false)
    expect(can(ctx, 'tenant.manage', {})).toBe(false)
  })

  test('legacy super_admin resolves to platform_admin without membership', async () => {
    const ctx = await resolveAuthorizationContext(db, { userId: legacySuper.id })
    expect(ctx.isPlatformAdmin).toBe(true)
    expect(ctx.eligible).toBe(true)
  })

  test('cashier and staff are denied audit administration by default', async () => {
    const cashierCtx = await resolveAuthorizationContext(db, { userId: userPlain.id })
    expect(can(cashierCtx, 'audit.read', {})).toBe(false)
    expect(ROLE_BASELINE_PERMISSIONS.cashier).toEqual([])
    expect(ROLE_BASELINE_PERMISSIONS.staff).toEqual([])
  })
})

describe('AUTH-1 context & attack matrix', () => {
  test('client-supplied tenant/store IDs never grant authorization by themselves', async () => {
    // userPlain has NO memberships: even explicitly requesting tenantA/storeA1
    // must not authorize.
    const ctx = await resolveAuthorizationContext(db, {
      userId: userPlain.id,
      activeTenantId: tenantA.id,
      activeStoreId: storeA1.id
    })
    expect(ctx.activeTenantId).toBeNull()
    expect(ctx.activeStoreId).toBeNull()
    expect(can(ctx, 'audit.read', { tenantId: tenantA.id, storeId: storeA1.id })).toBe(false)
  })

  test('foreign activeTenant request is denied', async () => {
    const ctx = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: 999999 })
    expect(ctx.activeTenantId).toBeNull()
  })

  test('inactive account is ineligible even with active membership', async () => {
    await db.user.update({ status: 'inactive' }, { where: { id: userMulti.id } })
    try {
      const ctx = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantA.id })
      expect(ctx.eligible).toBe(false)
      expect(can(ctx, 'audit.read', { tenantId: tenantA.id })).toBe(false)
    } finally {
      await db.user.update({ status: 'active' }, { where: { id: userMulti.id } })
    }
  })

  test('stale/forged JWT claims cannot escalate: context resolves from DB, not the token', async () => {
    const jwt = require('jsonwebtoken')
    const forged = jwt.sign(
      { id: userPlain.id, userName: 'x', roleType: 'super_admin', store: storeA1.id },
      process.env.JWT_SECRET_KEY || 'secret-key-user'
    )
    const authorization = require('../utils/authorization')
    const req = { headers: { authorization: `Bearer ${forged}` }, cookies: {} }
    await new Promise((resolve) => authorization(req, {}, resolve))
    // Middleware decodes claims, but the authorization decision ignores them:
    const ctx = await resolveAuthorizationContext(db, { userId: req.user.id })
    expect(ctx.isPlatformAdmin).toBe(false)
    expect(can(ctx, 'audit.read', {})).toBe(false)
  })

  test('membership status vocabulary matches DR-03', async () => {
    expect(MEMBERSHIP_STATUS).toEqual(expect.arrayContaining(['ACTIVE', 'DEACTIVATED', 'RETIRED']))
  })
})

describe('AUTH-1 AUD-3 readiness: tenant-aware scope derivation', () => {
  test('tenant_admin derives tenant-wide scope; store_admin derives assigned-store scope', async () => {
    const { auditScopeFor } = require('../utils/authContext')
    const tenantCtx = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantA.id })
    expect(auditScopeFor(tenantCtx)).toEqual({ tenantId: tenantA.id, storeIds: null })
    const storeCtx = await resolveAuthorizationContext(db, { userId: userMulti.id, activeTenantId: tenantB.id })
    expect(auditScopeFor(storeCtx)).toEqual({ tenantId: tenantB.id, storeIds: [storeB1.id] })
  })

  test('no scope is derived without an effective membership', async () => {
    const { auditScopeFor } = require('../utils/authContext')
    const ctx = await resolveAuthorizationContext(db, { userId: userPlain.id })
    expect(auditScopeFor(ctx)).toBeNull()
  })
})
