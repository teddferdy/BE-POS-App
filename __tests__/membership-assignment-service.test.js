'use strict'

process.env.NODE_ENV = 'test'

// T-03A: membership / assignment mutation primitives. Service is
// HTTP-agnostic: actor authority arrives as an explicit context built from
// the server-resolved canonical auth context (captive to these tests).
const db = require('../db/models')
const { recordAudit } = require('../utils/auditLog')

jest.mock('../utils/auditLog', () => {
  const actual = jest.requireActual('../utils/auditLog')
  return { ...actual, recordAudit: jest.fn(actual.recordAudit) }
})

const service = require('../api/service/membershipAssignmentService')

const P = 'T03A_'
const uid = () => `${P}${Date.now()}_${Math.floor(Math.random() * 1e6)}`

let tenantA
let tenantB
let storeA1
let storeA2
let storeB1
let storeNull
let platformUser
let tenantAdminA
let storeAdminA
let cashierA

const actorOf = (user, role, tenantId = null, storeId = null) => ({
  userId: user.id,
  role,
  tenantId,
  storeId
})

let platformActor
let tenantAdminActor
let storeAdminActor
let cashierActor

const makeUser = (tag) =>
  db.user.create({
    userName: `${uid()}_${tag}`,
    email: `${uid()}_${tag}@test.com`,
    roleType: 'user',
    status: 'active',
    password: 'Test12345'
  })

const makeSession = (userId, tenantId = null, storeId = null) =>
  db.authorizationContextSession.create({
    sessionId: require('crypto').randomBytes(32).toString('hex'),
    userId,
    activeTenantId: tenantId,
    activeStoreId: storeId,
    version: 1,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    revokedAt: null
  })

const liveSessions = async (userId) =>
  db.authorizationContextSession.findAll({ where: { userId, revokedAt: null } })

beforeAll(async () => {
  const tag = uid()
  tenantA = await db.tenant.create({ code: `${tag}_A`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${tag}_B`, name: `${P}Tenant B` })
  storeA1 = await db.location.create({ name: `${P}A1`, status: 'active', tenantId: tenantA.id })
  storeA2 = await db.location.create({ name: `${P}A2`, status: 'active', tenantId: tenantA.id })
  storeB1 = await db.location.create({ name: `${P}B1`, status: 'active', tenantId: tenantB.id })
  storeNull = await db.location.create({ name: `${P}NULL`, status: 'draft', tenantId: null })

  platformUser = await makeUser('platform')
  tenantAdminA = await makeUser('tadmin')
  storeAdminA = await makeUser('sadmin')
  cashierA = await makeUser('cashier')

  await db.tenantMembership.create({ userId: tenantAdminA.id, tenantId: tenantA.id, role: 'tenant_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: storeAdminA.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: cashierA.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: storeAdminA.id, tenantId: tenantA.id, storeId: storeA1.id })
  await db.storeAssignment.create({ userId: cashierA.id, tenantId: tenantA.id, storeId: storeA1.id })

  platformActor = actorOf(platformUser, 'platform_admin')
  tenantAdminActor = actorOf(tenantAdminA, 'tenant_admin', tenantA.id)
  storeAdminActor = actorOf(storeAdminA, 'store_admin', tenantA.id, storeA1.id)
  cashierActor = actorOf(cashierA, 'cashier', tenantA.id, storeA1.id)
}, 30000)

afterAll(async () => {
  await db.authorizationContextSession.destroy({ where: {}, force: true }).catch(() => {})
  await db.auditLog.destroy({ where: {}, __auditMaintenance: true }).catch(() => {})
  await db.storeAssignment.destroy({ where: {}, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: {}, force: true }).catch(() => {})
  await db.location.destroy({ where: {}, force: true }).catch(() => {})
  await db.user.destroy({ where: {}, force: true }).catch(() => {})
  await db.tenant.destroy({ where: {}, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 30000)

beforeEach(() => {
  recordAudit.mockClear()
})

describe('T-03A membership primitives', () => {
  test('platform_admin creates a new ACTIVE membership with audit + scope', async () => {
    const target = await makeUser('m1')
    const res = await service.createMembership({
      actor: platformActor,
      targetUserId: target.id,
      tenantId: tenantA.id,
      role: 'cashier',
      reason: 'staff onboarding',
      requestId: 'req-create-1'
    })

    expect(res.created).toBe(true)
    expect(res.membership.status).toBe('ACTIVE')
    expect(res.membership.role).toBe('cashier')
    expect(res.requestId).toBe('req-create-1')
    expect(res.scope).toEqual(expect.objectContaining({ accountId: target.id }))
    const audit = await db.auditLog.findOne({ where: { entity: 'membership', action: 'create' }, order: [['id', 'DESC']] })
    expect(audit).not.toBeNull()
    expect(audit.tenantId).toBe(tenantA.id)
    expect(audit.userId).toBe(platformUser.id)
    expect(audit.requestId).toBe('req-create-1')
    expect(audit.oldValues).toBeNull()
    expect(audit.newValues).toEqual(expect.objectContaining({ status: 'ACTIVE', role: 'cashier' }))
  })

  test('creating over an ACTIVE row is an idempotent success, no duplicate', async () => {
    const target = await makeUser('m2')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    const res = await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })

    expect(res.created).toBe(false)
    expect(res.noOp).toBe(true)
    expect(await db.tenantMembership.count({ where: { userId: target.id, tenantId: tenantA.id } })).toBe(1)
  })

  test('creating over a DEACTIVATED row reactivates it', async () => {
    const target = await makeUser('m3')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'pause' })
    const res = await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })

    expect(res.reactivated).toBe(true)
    expect(res.membership.status).toBe('ACTIVE')
  })

  test('creating over a RETIRED row is rejected', async () => {
    const target = await makeUser('m4')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.retireMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'left company' })
    await expect(
      service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
  })

  test('ACTIVE → DEACTIVATED flips status, audits, and revokes sessions', async () => {
    const target = await makeUser('m5')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    const s1 = await makeSession(target.id, tenantA.id)
    const s2 = await makeSession(target.id)
    const res = await service.deactivateMembership({
      actor: platformActor,
      targetUserId: target.id,
      tenantId: tenantA.id,
      reason: 'suspension'
    })

    expect(res.membership.status).toBe('DEACTIVATED')
    expect(res.revokedSessions).toBe(2)
    expect(await liveSessions(target.id)).toHaveLength(0)
    expect((await db.authorizationContextSession.findByPk(s1.id)).revokedAt).not.toBeNull()
    expect((await db.authorizationContextSession.findByPk(s2.id)).revokedAt).not.toBeNull()
    const audit = await db.auditLog.findOne({ where: { entity: 'membership', action: 'deactivate' }, order: [['id', 'DESC']] })
    expect(audit.oldValues).toEqual(expect.objectContaining({ status: 'ACTIVE' }))
    expect(audit.newValues).toEqual(expect.objectContaining({ status: 'DEACTIVATED' }))
    expect(audit.reason).toBe('suspension')
  })

  test('deactivating an already-DEACTIVATED row is a no-op success', async () => {
    const target = await makeUser('m6')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    const res = await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    expect(res.noOp).toBe(true)
  })

  test('DEACTIVATED → ACTIVE reactivates without revoking sessions', async () => {
    const target = await makeUser('m7')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    const session = await makeSession(target.id)
    const res = await service.reactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id })
    expect(res.membership.status).toBe('ACTIVE')
    expect(await liveSessions(target.id)).toHaveLength(1)
    expect((await db.authorizationContextSession.findByPk(session.id)).revokedAt).toBeNull()
  })

  test('ACTIVE → RETIRED and DEACTIVATED → RETIRED are terminal', async () => {
    const target = await makeUser('m8')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    const retired = await service.retireMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'gone' })
    expect(retired.membership.status).toBe('RETIRED')

    const target2 = await makeUser('m8b')
    await service.createMembership({ actor: platformActor, targetUserId: target2.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target2.id, tenantId: tenantA.id, reason: 'x' })
    const retired2 = await service.retireMembership({ actor: platformActor, targetUserId: target2.id, tenantId: tenantA.id, reason: 'gone' })
    expect(retired2.membership.status).toBe('RETIRED')
  })

  test('RETIRED → ACTIVE and RETIRED → DEACTIVATED are rejected', async () => {
    const target = await makeUser('m9')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.retireMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    await expect(
      service.reactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
    await expect(
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
  })

  test('role upgrade succeeds without revoking sessions', async () => {
    const target = await makeUser('m10')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await makeSession(target.id)
    const res = await service.changeMembershipRole({
      actor: platformActor,
      targetUserId: target.id,
      tenantId: tenantA.id,
      role: 'cashier',
      reason: 'promotion'
    })
    expect(res.membership.role).toBe('cashier')
    expect(res.downgrade).toBe(false)
    expect(await liveSessions(target.id)).toHaveLength(1)
  })

  test('role downgrade revokes sessions and audits before/after', async () => {
    const target = await makeUser('m11')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'store_admin' })
    await makeSession(target.id)
    const res = await service.changeMembershipRole({
      actor: platformActor,
      targetUserId: target.id,
      tenantId: tenantA.id,
      role: 'cashier',
      reason: 'demotion'
    })
    expect(res.downgrade).toBe(true)
    expect(await liveSessions(target.id)).toHaveLength(0)
    const audit = await db.auditLog.findOne({ where: { entity: 'membership', action: 'role.change' }, order: [['id', 'DESC']] })
    expect(audit.oldValues).toEqual(expect.objectContaining({ role: 'store_admin' }))
    expect(audit.newValues).toEqual(expect.objectContaining({ role: 'cashier' }))
  })

  test('role change on non-ACTIVE membership is rejected (no silent reactivation)', async () => {
    const target = await makeUser('m12')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    await expect(
      service.changeMembershipRole({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier', reason: 'x' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
    expect((await db.tenantMembership.findOne({ where: { userId: target.id, tenantId: tenantA.id } })).status).toBe('DEACTIVATED')
  })

  test('same-role change is a no-op', async () => {
    const target = await makeUser('m13')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    const res = await service.changeMembershipRole({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff', reason: 'x' })
    expect(res.noOp).toBe(true)
  })

  test('invalid role is rejected', async () => {
    const target = await makeUser('m14')
    await expect(
      service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'owner' })
    ).rejects.toMatchObject({ code: 'INVALID_ROLE', field: 'role' })
  })

  test('tenant_admin creates sub-roles in own tenant', async () => {
    const target = await makeUser('m15')
    const res = await service.createMembership({
      actor: tenantAdminActor,
      targetUserId: target.id,
      tenantId: tenantA.id,
      role: 'store_admin'
    })
    expect(res.created).toBe(true)
  })

  test('tenant_admin cannot grant tenant_admin or platform_admin (ceiling)', async () => {
    const target = await makeUser('m16')
    await expect(
      service.createMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, role: 'tenant_admin' })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
    await expect(
      service.createMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, role: 'platform_admin' })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
  })

  test('tenant_admin cannot touch another tenant', async () => {
    const target = await makeUser('m17')
    await expect(
      service.createMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantB.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'FOREIGN_TENANT' })
    await expect(
      service.deactivateMembership({ actor: tenantAdminActor, targetUserId: tenantAdminA.id, tenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'FOREIGN_TENANT' })
  })

  test('cashier cannot mutate membership', async () => {
    const target = await makeUser('m18')
    await expect(
      service.createMembership({ actor: cashierActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  test('platform_admin may grant tenant_admin and platform_admin', async () => {
    const target = await makeUser('m19')
    const res = await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, role: 'tenant_admin' })
    expect(res.created).toBe(true)
    expect(res.membership.role).toBe('tenant_admin')
  })

  test('missing or blank reason is rejected for reductions', async () => {
    const target = await makeUser('m20')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await expect(
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id })
    ).rejects.toMatchObject({ code: 'INVALID_REASON' })
    await expect(
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: '   ' })
    ).rejects.toMatchObject({ code: 'INVALID_REASON' })
    await expect(
      service.changeMembershipRole({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    ).rejects.toMatchObject({ code: 'INVALID_REASON' })
  })

  test('audit failure rolls back the mutation', async () => {
    const target = await makeUser('m21')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    recordAudit.mockRejectedValueOnce(new Error('audit store down'))
    await expect(
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    ).rejects.toThrow('audit store down')
    expect((await db.tenantMembership.findOne({ where: { userId: target.id, tenantId: tenantA.id } })).status).toBe('ACTIVE')
  })

  test('platform moveMembership relocates across tenants atomically', async () => {
    const target = await makeUser('m22')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await makeSession(target.id, tenantA.id)
    const res = await service.moveMembership({
      actor: platformActor,
      targetUserId: target.id,
      fromTenantId: tenantA.id,
      toTenantId: tenantB.id,
      reason: 'transfer'
    })
    expect(res.source.status).toBe('DEACTIVATED')
    expect(res.target.status).toBe('ACTIVE')
    expect(res.target.role).toBe('cashier')
    expect(await liveSessions(target.id)).toHaveLength(0)
  })

  test('non-platform moveMembership is denied', async () => {
    const target = await makeUser('m23')
    await expect(
      service.moveMembership({ actor: tenantAdminActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('T-03A assignment primitives', () => {
  test('platform_admin grants an assignment with audit + scope', async () => {
    const target = await makeUser('a1')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    const res = await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    expect(res.created).toBe(true)
    expect(res.assignment).toEqual(expect.objectContaining({ userId: target.id, tenantId: tenantA.id, storeId: storeA1.id }))
    expect(res.scope.assignedStoreIds).toContain(storeA1.id)
    const audit = await db.auditLog.findOne({ where: { entity: 'assignment', action: 'grant' }, order: [['id', 'DESC']] })
    expect(audit).not.toBeNull()
    expect(audit.store).toBe(storeA1.id)
    expect(audit.newValues).toEqual(expect.objectContaining({ storeId: storeA1.id }))
  })

  test('duplicate grant is an idempotent no-op', async () => {
    const target = await makeUser('a2')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    const res = await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    expect(res.noOp).toBe(true)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(1)
  })

  test('revoke hard-deletes and revokes only sessions selecting that store', async () => {
    const target = await makeUser('a3')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    const onStore = await makeSession(target.id, tenantA.id, storeA1.id)
    const elsewhere = await makeSession(target.id, tenantA.id, storeA2.id)
    const res = await service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: 'off shift' })
    expect(res.revoked).toBe(true)
    expect(res.revokedSessions).toEqual([onStore.sessionId])
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(0)
    expect((await db.authorizationContextSession.findByPk(onStore.id)).revokedAt).not.toBeNull()
    expect((await db.authorizationContextSession.findByPk(elsewhere.id)).revokedAt).toBeNull()
    const audit = await db.auditLog.findOne({ where: { entity: 'assignment', action: 'revoke' }, order: [['id', 'DESC']] })
    expect(audit.oldValues).toEqual(expect.objectContaining({ storeId: storeA1.id }))
    expect(audit.newValues).toBeNull()
    expect(audit.reason).toBe('off shift')
  })

  test('revoking a missing assignment is an idempotent no-op', async () => {
    const target = await makeUser('a4')
    const res = await service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    expect(res.revoked).toBe(false)
    expect(res.noOp).toBe(true)
  })

  test('tenant_admin cannot grant into another tenant', async () => {
    const target = await makeUser('a5')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, role: 'cashier' })
    await expect(
      service.grantAssignment({ actor: tenantAdminActor, targetUserId: target.id, storeId: storeB1.id })
    ).rejects.toMatchObject({ code: 'FOREIGN_TENANT' })
  })

  test('store_admin grants their own store', async () => {
    const target = await makeUser('a6')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    const res = await service.grantAssignment({ actor: storeAdminActor, targetUserId: target.id, storeId: storeA1.id })
    expect(res.created).toBe(true)
  })

  test('store_admin cannot grant another store', async () => {
    const target = await makeUser('a7')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await expect(
      service.grantAssignment({ actor: storeAdminActor, targetUserId: target.id, storeId: storeA2.id })
    ).rejects.toMatchObject({ code: 'FOREIGN_STORE' })
  })

  test('platform_admin grants cross-tenant', async () => {
    const target = await makeUser('a8')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, role: 'cashier' })
    const res = await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeB1.id })
    expect(res.created).toBe(true)
  })

  test('grant without an ACTIVE membership is rejected', async () => {
    const target = await makeUser('a9')
    await expect(
      service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    await expect(
      service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
  })

  test('grant to a store with no tenant is rejected', async () => {
    const target = await makeUser('a10')
    await expect(
      service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeNull.id })
    ).rejects.toMatchObject({ code: 'STORE_TENANT_UNRESOLVED' })
  })

  test('moveAssignment relocates atomically with audit + targeted revocation', async () => {
    const target = await makeUser('a11')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    const onOld = await makeSession(target.id, tenantA.id, storeA1.id)
    const res = await service.moveAssignment({
      actor: platformActor,
      targetUserId: target.id,
      fromStoreId: storeA1.id,
      toStoreId: storeA2.id,
      reason: 'reassignment'
    })
    expect(res.moved).toBe(true)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(0)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA2.id } })).toBe(1)
    expect(res.revokedSessions).toEqual([onOld.sessionId])
  })

  test('moveAssignment with missing source leaves no partial state', async () => {
    const target = await makeUser('a12')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await expect(
      service.moveAssignment({ actor: platformActor, targetUserId: target.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'fromStoreId' })
    expect(await db.storeAssignment.count({ where: { userId: target.id } })).toBe(0)
  })

  test('assignment audit failure rolls back the revoke', async () => {
    const target = await makeUser('a13')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    recordAudit.mockRejectedValueOnce(new Error('audit store down'))
    await expect(
      service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: 'x' })
    ).rejects.toThrow('audit store down')
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(1)
  })
})

describe('T-03A concurrency', () => {
  test('concurrent membership creates arbitrate to one ACTIVE row', async () => {
    const target = await makeUser('c1')
    const results = await Promise.all([
      service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' }),
      service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    ])
    expect(results.every((r) => r.membership.status === 'ACTIVE')).toBe(true)
    expect(await db.tenantMembership.count({ where: { userId: target.id, tenantId: tenantA.id } })).toBe(1)
  })

  test('concurrent assignment grants arbitrate to one row', async () => {
    const target = await makeUser('c2')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    const results = await Promise.all([
      service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id }),
      service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    ])
    expect(results.every((r) => r.assignment.storeId === storeA1.id)).toBe(true)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(1)
  })

  test('concurrent status flips complete without error', async () => {
    const target = await makeUser('c3')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    const results = await Promise.allSettled([
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'a' }),
      service.reactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id })
    ])
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    const final = await db.tenantMembership.findOne({ where: { userId: target.id, tenantId: tenantA.id } })
    expect(['ACTIVE', 'DEACTIVATED']).toContain(final.status)
  })
})

describe('T-03A authority provenance', () => {
  test('mutation authority never comes from the payload body', async () => {
    const target = await makeUser('s1')
    await expect(
      service.createMembership({
        actor: cashierActor,
        targetUserId: target.id,
        tenantId: tenantA.id,
        role: 'staff',
        actorRole: 'platform_admin',
        actorUserId: platformUser.id,
        roleType: 'super_admin',
        store: storeA1.id
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await db.tenantMembership.count({ where: { userId: target.id } })).toBe(0)
  })

  test('persisted store tenant is authoritative, not caller input', async () => {
    const target = await makeUser('s2')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    // grantAssignment accepts no tenantId input at all: storeA1 persists
    // tenantA, so tenant B admin is denied from persisted state.
    await expect(
      service.grantAssignment({ actor: { ...tenantAdminActor, tenantId: tenantB.id }, targetUserId: target.id, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'FOREIGN_TENANT' })
  })

  test('service never consults JWT or legacy roleType/store claims', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../api/service/membershipAssignmentService.js'), 'utf8')
    expect(src).not.toMatch(/jsonwebtoken/)
    expect(src).not.toMatch(/jwt\.verify/)
    expect(src).not.toMatch(/req\.user/)
    expect(src).not.toMatch(/req\.body/)
    expect(src).not.toMatch(/roleType/)
    expect(src).not.toMatch(/bulkCreate/)
    expect(src).not.toMatch(/\.raw\(/)
    expect(src).toMatch(/recordAudit/)
    expect(src).toMatch(/sequelize\.transaction/)
  })
})
