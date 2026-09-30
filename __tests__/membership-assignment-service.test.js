'use strict'

process.env.NODE_ENV = 'test'

// T-03A: membership / assignment mutation primitives. Service is
// HTTP-agnostic: actor authority arrives as an explicit context built from
// the server-resolved canonical auth context (captive to these tests).
const db = require('../db/models')
const { recordAudit } = require('../utils/auditLog')
const socket = require('../api/service/socket')

jest.mock('../utils/auditLog', () => {
  const actual = jest.requireActual('../utils/auditLog')
  return { ...actual, recordAudit: jest.fn(actual.recordAudit) }
})

jest.mock('../api/service/socket', () => {
  const actual = jest.requireActual('../api/service/socket')
  return { ...actual, disconnectUser: jest.fn(), disconnectSession: jest.fn() }
})

const service = require('../api/service/membershipAssignmentService')
const { resolveAuthorizationContext } = require('../utils/authContext')

const P = 'T03A_'
const uid = () => `${P}${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const NONEXISTENT_ID = 2000000000

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

const member = async (tag, tenant, role, status = 'ACTIVE') => {
  const user = await makeUser(tag)
  await db.tenantMembership.create({ userId: user.id, tenantId: tenant.id, role, status })
  return user
}

const assign = (user, store) => db.storeAssignment.create({ userId: user.id, tenantId: store.tenantId, storeId: store.id })

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

const isRevoked = async (session) => (await db.authorizationContextSession.findByPk(session.id)).revokedAt != null

const membershipOf = (user, tenant) => db.tenantMembership.findOne({ where: { userId: user.id, tenantId: tenant.id } })

const caught = async (promise) => {
  try {
    await promise
  } catch (err) {
    return err
  }
  throw new Error('expected the operation to reject')
}

const shape = (err) => ({ code: err.code, field: err.field, message: err.message })

const auditCalls = () => recordAudit.mock.calls.length

const auditRowsFor = (requestId) => db.auditLog.count({ where: { requestId } })

// Deterministic transaction barrier: resolves 'waiting' once another backend
// of this test database is blocked on a lock (the operation under test hit a
// row held by the test's open transaction), or 'settled' when the operation
// finished without ever blocking. Polls actual lock state instead of sleeping.
const untilBlockedOrSettled = async (pending) => {
  let settled = false
  pending.then(
    () => { settled = true },
    () => { settled = true }
  )
  for (let i = 0; i < 1000; i += 1) {
    const [{ n }] = await db.sequelize.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
      { type: db.Sequelize.QueryTypes.SELECT }
    )
    if (n > 0) return 'waiting'
    if (settled) return 'settled'
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return 'timeout'
}

const lockingCalls = (spy) => spy.mock.calls.map(([opts], index) => ({ opts, index })).filter(({ opts }) => opts && opts.lock)

const ALLOWED_RESULT_KEYS = [
  'membership',
  'assignment',
  'source',
  'target',
  'created',
  'reactivated',
  'noOp',
  'revoked',
  'moved',
  'downgrade',
  'auditId',
  'auditIds',
  'requestId',
  'revokedSessionCount'
]

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
  socket.disconnectUser.mockClear()
  socket.disconnectSession.mockClear()
})

describe('T-03A membership primitives', () => {
  test('platform_admin creates a new ACTIVE membership with audit', async () => {
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
    expect(res.revokedSessionCount).toBe(0)
    expect(res).not.toHaveProperty('scope')
    const audit = await db.auditLog.findOne({ where: { entity: 'membership', action: 'create' }, order: [['id', 'DESC']] })
    expect(audit).not.toBeNull()
    expect(audit.id).toBe(res.auditId)
    expect(audit.tenantId).toBe(tenantA.id)
    expect(audit.userId).toBe(platformUser.id)
    expect(audit.requestId).toBe('req-create-1')
    expect(audit.oldValues).toBeNull()
    expect(audit.newValues).toEqual(expect.objectContaining({ status: 'ACTIVE', role: 'cashier' }))
  })

  test('creating over an ACTIVE same-role row is an idempotent success, no duplicate, no audit', async () => {
    const target = await makeUser('m2')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    recordAudit.mockClear()
    const res = await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })

    expect(res.created).toBe(false)
    expect(res.noOp).toBe(true)
    expect(res.auditId).toBeNull()
    expect(auditCalls()).toBe(0)
    expect(await db.tenantMembership.count({ where: { userId: target.id, tenantId: tenantA.id } })).toBe(1)
  })

  test('creating over a DEACTIVATED same-role row reactivates it', async () => {
    const target = await makeUser('m3')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'pause' })
    const res = await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })

    expect(res.reactivated).toBe(true)
    expect(res.membership.status).toBe('ACTIVE')
    expect(res.membership.role).toBe('staff')
  })

  test('creating over a RETIRED row is rejected', async () => {
    const target = await makeUser('m4')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.retireMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'left company' })
    await expect(
      service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
  })

  test('ACTIVE → DEACTIVATED flips status, audits, and revokes the sessions it authorized', async () => {
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
    // Sole effective membership: the pinned AND the tenant-less session both
    // derived their authority from it.
    expect(res.revokedSessionCount).toBe(2)
    expect(await liveSessions(target.id)).toHaveLength(0)
    expect(await isRevoked(s1)).toBe(true)
    expect(await isRevoked(s2)).toBe(true)
    const audit = await db.auditLog.findOne({ where: { entity: 'membership', action: 'deactivate' }, order: [['id', 'DESC']] })
    expect(audit.oldValues).toEqual(expect.objectContaining({ status: 'ACTIVE' }))
    expect(audit.newValues).toEqual(expect.objectContaining({ status: 'DEACTIVATED' }))
    expect(audit.reason).toBe('suspension')
  })

  test('deactivating an already-DEACTIVATED row is a no-op success without audit', async () => {
    const target = await makeUser('m6')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    recordAudit.mockClear()
    const res = await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    expect(res.noOp).toBe(true)
    expect(auditCalls()).toBe(0)
  })

  test('DEACTIVATED → ACTIVE reactivates without revoking sessions', async () => {
    const target = await makeUser('m7')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    const session = await makeSession(target.id)
    const res = await service.reactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id })
    expect(res.membership.status).toBe('ACTIVE')
    expect(res.revokedSessionCount).toBe(0)
    expect(await liveSessions(target.id)).toHaveLength(1)
    expect(await isRevoked(session)).toBe(false)
  })

  test('ACTIVE → RETIRED and DEACTIVATED → RETIRED are terminal', async () => {
    const target = await makeUser('m8')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    const retired = await service.retireMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'gone' })
    expect(retired.membership.status).toBe('RETIRED')

    const target2 = await makeUser('m8b')
    await service.createMembership({ actor: platformActor, targetUserId: target2.id, tenantId: tenantA.id, role: 'staff' })
    await service.deactivateMembership({ actor: platformActor, targetUserId: target2.id, tenantId: tenantA.id, reason: 'x' })
    const session = await makeSession(target2.id)
    const retired2 = await service.retireMembership({ actor: platformActor, targetUserId: target2.id, tenantId: tenantA.id, reason: 'gone' })
    expect(retired2.membership.status).toBe('RETIRED')
    // DEACTIVATED conferred no authority, so retiring it revokes nothing.
    expect(retired2.revokedSessionCount).toBe(0)
    expect(await isRevoked(session)).toBe(false)
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
    expect(res.revokedSessionCount).toBe(1)
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
    expect((await membershipOf(target, tenantA)).status).toBe('DEACTIVATED')
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

  test('tenant_admin reactivates a visible sub-role membership in own tenant', async () => {
    const target = await member('m15', tenantA, 'store_admin', 'DEACTIVATED')
    const res = await service.createMembership({
      actor: tenantAdminActor,
      targetUserId: target.id,
      tenantId: tenantA.id,
      role: 'store_admin'
    })
    expect(res.reactivated).toBe(true)
    expect(res.membership.status).toBe('ACTIVE')
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

  test('tenant_admin cannot touch another tenant (indistinguishable from missing)', async () => {
    const target = await makeUser('m17')
    await expect(
      service.createMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantB.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'tenantId' })
    await expect(
      service.deactivateMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'tenantId' })
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

  test('audit failure rolls back the mutation and its session revocation', async () => {
    const target = await makeUser('m21')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    const session = await makeSession(target.id, tenantA.id)
    recordAudit.mockRejectedValueOnce(new Error('audit store down'))
    await expect(
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    ).rejects.toThrow('audit store down')
    expect((await membershipOf(target, tenantA)).status).toBe('ACTIVE')
    expect(await isRevoked(session)).toBe(false)
    expect(socket.disconnectSession).not.toHaveBeenCalled()
  })

  test('platform moveMembership relocates across tenants in one transaction', async () => {
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
    expect(res.created).toBe(true)
    expect(res.auditIds).toHaveLength(2)
    expect(await liveSessions(target.id)).toHaveLength(0)
  })

  test('non-platform moveMembership is denied', async () => {
    const target = await makeUser('m23')
    await expect(
      service.moveMembership({ actor: tenantAdminActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('D1 persisted-target membership authority', () => {
  test('tenant_admin cannot deactivate, retire, reactivate or re-role a peer tenant_admin', async () => {
    const peer = await member('d1peer', tenantA, 'tenant_admin')
    for (const op of [
      () => service.deactivateMembership({ actor: tenantAdminActor, targetUserId: peer.id, tenantId: tenantA.id, reason: 'x' }),
      () => service.retireMembership({ actor: tenantAdminActor, targetUserId: peer.id, tenantId: tenantA.id, reason: 'x' }),
      () => service.changeMembershipRole({ actor: tenantAdminActor, targetUserId: peer.id, tenantId: tenantA.id, role: 'staff', reason: 'x' })
    ]) {
      await expect(op()).rejects.toMatchObject({ code: 'ROLE_CEILING', field: 'targetUserId' })
    }
    expect(await membershipOf(peer, tenantA)).toMatchObject({ role: 'tenant_admin', status: 'ACTIVE' })

    await service.deactivateMembership({ actor: platformActor, targetUserId: peer.id, tenantId: tenantA.id, reason: 'x' })
    await expect(
      service.reactivateMembership({ actor: tenantAdminActor, targetUserId: peer.id, tenantId: tenantA.id })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
    expect((await membershipOf(peer, tenantA)).status).toBe('DEACTIVATED')
    expect(auditCalls()).toBe(1)
  })

  test('tenant_admin cannot mutate a platform_admin membership in its tenant', async () => {
    const plat = await member('d1plat', tenantA, 'platform_admin')
    await expect(
      service.deactivateMembership({ actor: tenantAdminActor, targetUserId: plat.id, tenantId: tenantA.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
    await expect(
      service.changeMembershipRole({ actor: tenantAdminActor, targetUserId: plat.id, tenantId: tenantA.id, role: 'staff', reason: 'x' })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
    expect(await membershipOf(plat, tenantA)).toMatchObject({ role: 'platform_admin', status: 'ACTIVE' })
  })

  test('tenant_admin manages a store_admin target', async () => {
    const target = await member('d1sa', tenantA, 'store_admin')
    const res = await service.deactivateMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    expect(res.membership.status).toBe('DEACTIVATED')
  })

  test('platform_admin manages privileged targets', async () => {
    const ta = await member('d1pta', tenantA, 'tenant_admin')
    const pa = await member('d1ppa', tenantA, 'platform_admin')
    expect((await service.deactivateMembership({ actor: platformActor, targetUserId: ta.id, tenantId: tenantA.id, reason: 'x' })).noOp).toBe(false)
    expect((await service.retireMembership({ actor: platformActor, targetUserId: pa.id, tenantId: tenantA.id, reason: 'x' })).membership.status).toBe('RETIRED')
  })

  test('create/reactivate cannot resurrect or silently re-role a privileged persisted membership', async () => {
    const ta = await member('d1res', tenantA, 'tenant_admin', 'DEACTIVATED')
    // Requested role passes the ceiling, but the persisted role does not.
    await expect(
      service.createMembership({ actor: tenantAdminActor, targetUserId: ta.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
    // Even platform_admin cannot change the role through reactivation.
    await expect(
      service.createMembership({ actor: platformActor, targetUserId: ta.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_CONFLICT', field: 'role' })
    expect(await membershipOf(ta, tenantA)).toMatchObject({ role: 'tenant_admin', status: 'DEACTIVATED' })
  })
})

describe('D2 self-action prohibition', () => {
  const SELF = { code: 'FORBIDDEN', field: 'targetUserId' }

  test('no self membership lifecycle or role change, including platform_admin', async () => {
    const self = tenantAdminA.id
    await expect(service.deactivateMembership({ actor: tenantAdminActor, targetUserId: self, tenantId: tenantA.id, reason: 'x' })).rejects.toMatchObject(SELF)
    await expect(service.retireMembership({ actor: tenantAdminActor, targetUserId: self, tenantId: tenantA.id, reason: 'x' })).rejects.toMatchObject(SELF)
    await expect(service.reactivateMembership({ actor: tenantAdminActor, targetUserId: self, tenantId: tenantA.id })).rejects.toMatchObject(SELF)
    // Self downgrade.
    await expect(
      service.changeMembershipRole({ actor: tenantAdminActor, targetUserId: self, tenantId: tenantA.id, role: 'store_admin', reason: 'x' })
    ).rejects.toMatchObject(SELF)

    const plat = await member('d2plat', tenantB, 'cashier')
    const platActor = actorOf(plat, 'platform_admin')
    // Self upgrade and self create, even for platform_admin.
    await expect(
      service.changeMembershipRole({ actor: platActor, targetUserId: plat.id, tenantId: tenantB.id, role: 'tenant_admin', reason: 'x' })
    ).rejects.toMatchObject(SELF)
    await expect(
      service.createMembership({ actor: platActor, targetUserId: plat.id, tenantId: tenantA.id, role: 'tenant_admin' })
    ).rejects.toMatchObject(SELF)
    await expect(
      service.moveMembership({ actor: platActor, targetUserId: plat.id, fromTenantId: tenantB.id, toTenantId: tenantA.id, reason: 'x' })
    ).rejects.toMatchObject(SELF)
    expect(await membershipOf(plat, tenantA)).toBeNull()
    expect(await membershipOf(tenantAdminA, tenantA)).toMatchObject({ role: 'tenant_admin', status: 'ACTIVE' })
    expect(auditCalls()).toBe(0)
  })

  test('no self assignment grant, revoke or move', async () => {
    await expect(service.grantAssignment({ actor: tenantAdminActor, targetUserId: tenantAdminA.id, storeId: storeA1.id })).rejects.toMatchObject(SELF)
    await expect(service.revokeAssignment({ actor: storeAdminActor, targetUserId: storeAdminA.id, storeId: storeA1.id, reason: 'x' })).rejects.toMatchObject(SELF)
    await expect(
      service.moveAssignment({ actor: platformActor, targetUserId: platformUser.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' })
    ).rejects.toMatchObject(SELF)
    expect(await db.storeAssignment.count({ where: { userId: storeAdminA.id, storeId: storeA1.id } })).toBe(1)
  })
})

describe('D3/D16 membership creation semantics', () => {
  test('different role over ACTIVE or DEACTIVATED is a conflict, state untouched', async () => {
    const active = await member('d3a', tenantA, 'cashier')
    await expect(
      service.createMembership({ actor: platformActor, targetUserId: active.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_CONFLICT', field: 'role' })
    const inactive = await member('d3d', tenantA, 'cashier', 'DEACTIVATED')
    await expect(
      service.createMembership({ actor: tenantAdminActor, targetUserId: inactive.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_CONFLICT', field: 'role' })
    expect(await membershipOf(active, tenantA)).toMatchObject({ role: 'cashier', status: 'ACTIVE' })
    expect(await membershipOf(inactive, tenantA)).toMatchObject({ role: 'cashier', status: 'DEACTIVATED' })
    expect(auditCalls()).toBe(0)
  })

  test('platform_admin introduces an existing global user; tenant_admin cannot', async () => {
    const outsider = await member('d16out', tenantB, 'cashier')
    const res = await service.createMembership({ actor: platformActor, targetUserId: outsider.id, tenantId: tenantA.id, role: 'staff' })
    expect(res.created).toBe(true)

    const outsider2 = await member('d16out2', tenantB, 'cashier')
    const foreign = await caught(
      service.createMembership({ actor: tenantAdminActor, targetUserId: outsider2.id, tenantId: tenantA.id, role: 'staff' })
    )
    const missing = await caught(
      service.createMembership({ actor: tenantAdminActor, targetUserId: NONEXISTENT_ID, tenantId: tenantA.id, role: 'staff' })
    )
    expect(shape(foreign)).toEqual({ code: 'RESOURCE_NOT_FOUND', field: 'userId', message: 'userId not found' })
    expect(shape(missing)).toEqual(shape(foreign))
    expect(await membershipOf(outsider2, tenantA)).toBeNull()
  })

  test('RETIRED stays terminal for tenant_admin too', async () => {
    const target = await member('d16ret', tenantA, 'staff', 'RETIRED')
    await expect(
      service.createMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
  })
})

describe('D6 assignment target-role ceiling', () => {
  test('tenant_admin assigns store_admin, cashier and staff targets', async () => {
    for (const role of ['store_admin', 'cashier', 'staff']) {
      const target = await member(`d6ta_${role}`, tenantA, role)
      const res = await service.grantAssignment({ actor: tenantAdminActor, targetUserId: target.id, storeId: storeA2.id })
      expect(res.created).toBe(true)
    }
  })

  test('tenant_admin cannot assign a peer tenant_admin', async () => {
    const peer = await member('d6peer', tenantA, 'tenant_admin')
    await expect(
      service.grantAssignment({ actor: tenantAdminActor, targetUserId: peer.id, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING', field: 'targetUserId' })
  })

  test('store_admin assigns cashier and staff only', async () => {
    for (const role of ['cashier', 'staff']) {
      const target = await member(`d6sa_${role}`, tenantA, role)
      const res = await service.grantAssignment({ actor: storeAdminActor, targetUserId: target.id, storeId: storeA1.id })
      expect(res.created).toBe(true)
    }
    const peer = await member('d6sapeer', tenantA, 'store_admin')
    await expect(
      service.grantAssignment({ actor: storeAdminActor, targetUserId: peer.id, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
    await expect(
      service.grantAssignment({ actor: storeAdminActor, targetUserId: tenantAdminA.id, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
  })

  test('cashier and staff have no assignment authority', async () => {
    const staffUser = await member('d6staff', tenantA, 'staff')
    const staffActor = actorOf(staffUser, 'staff', tenantA.id, storeA1.id)
    const target = await member('d6t', tenantA, 'staff')
    await expect(service.grantAssignment({ actor: cashierActor, targetUserId: target.id, storeId: storeA1.id })).rejects.toMatchObject({ code: 'FORBIDDEN', field: 'actor' })
    await expect(service.revokeAssignment({ actor: staffActor, targetUserId: target.id, storeId: storeA1.id, reason: 'x' })).rejects.toMatchObject({ code: 'FORBIDDEN', field: 'actor' })
  })

  test('the persisted role, not a prior state, governs revoke and move', async () => {
    const target = await member('d6pers', tenantA, 'cashier')
    await assign(target, storeA1)
    await service.changeMembershipRole({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'store_admin', reason: 'promotion' })
    await expect(
      service.revokeAssignment({ actor: storeAdminActor, targetUserId: target.id, storeId: storeA1.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })

    const peer = await member('d6mv', tenantA, 'tenant_admin')
    await assign(peer, storeA1)
    await expect(
      service.moveAssignment({ actor: tenantAdminActor, targetUserId: peer.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'ROLE_CEILING' })
    expect(await db.storeAssignment.count({ where: { userId: peer.id, storeId: storeA1.id } })).toBe(1)
  })
})

describe('D14 no existence oracle for scoped actors', () => {
  test('tenant_admin: foreign tenant user and nonexistent user are indistinguishable on membership mutations', async () => {
    const outsider = await member('d14out', tenantB, 'cashier')
    const noMembership = await makeUser('d14none')
    const errs = await Promise.all([
      caught(service.deactivateMembership({ actor: tenantAdminActor, targetUserId: outsider.id, tenantId: tenantA.id, reason: 'x' })),
      caught(service.deactivateMembership({ actor: tenantAdminActor, targetUserId: noMembership.id, tenantId: tenantA.id, reason: 'x' })),
      caught(service.deactivateMembership({ actor: tenantAdminActor, targetUserId: NONEXISTENT_ID, tenantId: tenantA.id, reason: 'x' }))
    ])
    for (const err of errs) expect(shape(err)).toEqual({ code: 'RESOURCE_NOT_FOUND', field: 'userId', message: 'userId not found' })
  })

  test('tenant_admin: foreign, tenant-less and nonexistent stores are indistinguishable', async () => {
    const target = await member('d14st', tenantA, 'cashier')
    const errs = await Promise.all([
      caught(service.grantAssignment({ actor: tenantAdminActor, targetUserId: target.id, storeId: storeB1.id })),
      caught(service.grantAssignment({ actor: tenantAdminActor, targetUserId: target.id, storeId: storeNull.id })),
      caught(service.grantAssignment({ actor: tenantAdminActor, targetUserId: target.id, storeId: NONEXISTENT_ID }))
    ])
    for (const err of errs) expect(shape(err)).toEqual({ code: 'RESOURCE_NOT_FOUND', field: 'storeId', message: 'storeId not found' })
  })

  test('store_admin: another store and a nonexistent store are indistinguishable', async () => {
    const target = await member('d14sa', tenantA, 'cashier')
    const other = await caught(service.grantAssignment({ actor: storeAdminActor, targetUserId: target.id, storeId: storeA2.id }))
    const missing = await caught(service.grantAssignment({ actor: storeAdminActor, targetUserId: target.id, storeId: NONEXISTENT_ID }))
    expect(shape(other)).toEqual({ code: 'RESOURCE_NOT_FOUND', field: 'storeId', message: 'storeId not found' })
    expect(shape(missing)).toEqual(shape(other))
  })

  test('store_admin: assignment existence at a foreign store is not revealed', async () => {
    const assigned = await member('d14as', tenantA, 'cashier')
    await assign(assigned, storeA2)
    const unassigned = await member('d14un', tenantA, 'cashier')
    const a = await caught(service.revokeAssignment({ actor: storeAdminActor, targetUserId: assigned.id, storeId: storeA2.id, reason: 'x' }))
    const b = await caught(service.revokeAssignment({ actor: storeAdminActor, targetUserId: unassigned.id, storeId: storeA2.id, reason: 'x' }))
    expect(shape(a)).toEqual(shape(b))
    expect(a.code).toBe('RESOURCE_NOT_FOUND')
    expect(await db.storeAssignment.count({ where: { userId: assigned.id, storeId: storeA2.id } })).toBe(1)
  })

  test('tenant_admin: user outside the tenant and nonexistent user are indistinguishable on assignments', async () => {
    const outsider = await member('d14ao', tenantB, 'cashier')
    const a = await caught(service.revokeAssignment({ actor: tenantAdminActor, targetUserId: outsider.id, storeId: storeA1.id, reason: 'x' }))
    const b = await caught(service.revokeAssignment({ actor: tenantAdminActor, targetUserId: NONEXISTENT_ID, storeId: storeA1.id, reason: 'x' }))
    expect(shape(a)).toEqual({ code: 'RESOURCE_NOT_FOUND', field: 'userId', message: 'userId not found' })
    expect(shape(b)).toEqual(shape(a))
  })

  test('same-store move and missing assignment are authorized before answering', async () => {
    const outsider = await member('d14mv', tenantB, 'cashier')
    await expect(
      service.moveAssignment({ actor: tenantAdminActor, targetUserId: outsider.id, fromStoreId: storeA1.id, toStoreId: storeA1.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'userId' })
    await expect(
      service.moveAssignment({ actor: cashierActor, targetUserId: outsider.id, fromStoreId: storeA1.id, toStoreId: storeA1.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', field: 'actor' })
    // An authorized actor may learn that there is nothing to revoke.
    const visible = await member('d14vis', tenantA, 'cashier')
    const res = await service.revokeAssignment({ actor: tenantAdminActor, targetUserId: visible.id, storeId: storeA2.id, reason: 'x' })
    expect(res).toMatchObject({ revoked: false, noOp: true, auditId: null })
  })
})

describe('D7 mutation results carry no scope or session identifiers', () => {
  test('every result exposes only the allowed fields', async () => {
    const target = await makeUser('d7')
    const sessionA = await makeSession(target.id, tenantA.id, storeA1.id)
    const results = []
    results.push(await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' }))
    results.push(await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id }))
    results.push(await service.moveAssignment({ actor: platformActor, targetUserId: target.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' }))
    results.push(await service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA2.id, reason: 'x' }))
    results.push(await service.changeMembershipRole({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'staff', reason: 'x' }))
    results.push(await service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' }))
    results.push(await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, reason: 'x' }))
    results.push(await service.reactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id }))

    for (const res of results) {
      for (const key of Object.keys(res)) expect(ALLOWED_RESULT_KEYS).toContain(key)
      const text = JSON.stringify(res)
      expect(text).not.toContain(sessionA.sessionId)
      for (const leak of ['scope', 'permissions', 'memberships', 'effectiveTenantIds', 'assignedStoreIds', 'sessionId', 'token']) {
        expect(text).not.toContain(`"${leak}"`)
      }
      expect(typeof res.revokedSessionCount).toBe('number')
    }
    expect(await isRevoked(sessionA)).toBe(true)
  })
})

describe('D5-B tenant-scoped session revocation', () => {
  test('tenant A reduction revokes tenant A sessions only; tenant B and multi-tenant tenant-less sessions survive', async () => {
    const target = await makeUser('d5multi')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'cashier', status: 'ACTIVE' })
    const onA = await makeSession(target.id, tenantA.id)
    const onB = await makeSession(target.id, tenantB.id)
    const unscoped = await makeSession(target.id)

    const res = await service.deactivateMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })

    expect(res.revokedSessionCount).toBe(1)
    expect(await isRevoked(onA)).toBe(true)
    expect(await isRevoked(onB)).toBe(false)
    expect(await isRevoked(unscoped)).toBe(false)
    expect(socket.disconnectSession).toHaveBeenCalledTimes(1)
    expect(socket.disconnectSession).toHaveBeenCalledWith(onA.sessionId)
    expect(socket.disconnectUser).not.toHaveBeenCalled()
  })

  test('tenant-less session is revoked when the reduced membership was the sole effective one', async () => {
    const target = await member('d5sole', tenantA, 'cashier')
    const unscoped = await makeSession(target.id)
    const res = await service.deactivateMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    expect(res.revokedSessionCount).toBe(1)
    expect(await isRevoked(unscoped)).toBe(true)
    expect(socket.disconnectSession).toHaveBeenCalledWith(unscoped.sessionId)
    expect(socket.disconnectUser).not.toHaveBeenCalled()
  })

  test('downgrade and move are tenant-scoped too', async () => {
    const target = await makeUser('d5down')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'cashier', status: 'ACTIVE' })
    const onA = await makeSession(target.id, tenantA.id)
    const onB = await makeSession(target.id, tenantB.id)
    await service.changeMembershipRole({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier', reason: 'x' })
    expect(await isRevoked(onA)).toBe(true)
    expect(await isRevoked(onB)).toBe(false)

    const mover = await member('d5move', tenantA, 'cashier')
    const moverOnA = await makeSession(mover.id, tenantA.id)
    const tenantC = await db.tenant.create({ code: `${uid()}_C`, name: `${P}Tenant C` })
    await db.tenantMembership.create({ userId: mover.id, tenantId: tenantC.id, role: 'staff', status: 'ACTIVE' })
    const moverOnC = await makeSession(mover.id, tenantC.id)
    await service.moveMembership({ actor: platformActor, targetUserId: mover.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    expect(await isRevoked(moverOnA)).toBe(true)
    expect(await isRevoked(moverOnC)).toBe(false)
  })

  test('platform_admin membership reduction revokes every session and disconnects the user', async () => {
    const target = await makeUser('d5plat')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'platform_admin', status: 'ACTIVE' })
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'cashier', status: 'ACTIVE' })
    const sessions = [await makeSession(target.id, tenantA.id), await makeSession(target.id, tenantB.id), await makeSession(target.id)]

    const res = await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })

    expect(res.revokedSessionCount).toBe(3)
    for (const session of sessions) expect(await isRevoked(session)).toBe(true)
    expect(socket.disconnectUser).toHaveBeenCalledWith(target.id)
  })
})

describe('D9 audit only successful state changes', () => {
  test('one audit per state change; none for no-op, authorization or validation failures', async () => {
    const target = await member('d9', tenantA, 'cashier')
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    expect(auditCalls()).toBe(1)

    recordAudit.mockClear()
    await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' })
    await caught(service.deactivateMembership({ actor: cashierActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x' }))
    await caught(service.reactivateMembership({ actor: tenantAdminActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'r'.repeat(501) }))
    expect(auditCalls()).toBe(0)
  })

  test('rolled-back move commits no audit row', async () => {
    const target = await member('d9rb', tenantA, 'cashier')
    recordAudit.mockImplementationOnce(jest.requireActual('../utils/auditLog').recordAudit)
    recordAudit.mockRejectedValueOnce(new Error('audit store down'))
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x', requestId: 'd9-rollback' })
    ).rejects.toThrow('audit store down')
    expect(await auditRowsFor('d9-rollback')).toBe(0)
  })
})

describe('D10 atomic membership move', () => {
  test('locks the user\'s whole membership set once, in ascending tenantId order', async () => {
    const target = await member('d10lock', tenantB, 'cashier')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'cashier', status: 'DEACTIVATED' })
    const findAll = jest.spyOn(db.tenantMembership, 'findAll')
    const findOne = jest.spyOn(db.tenantMembership, 'findOne')
    try {
      await service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantB.id, toTenantId: tenantA.id, reason: 'x' })
      const locks = lockingCalls(findAll)
      expect(locks).toHaveLength(1)
      expect(locks[0].opts.where).toEqual({ userId: target.id })
      expect(locks[0].opts.order).toEqual([['tenantId', 'ASC']])
      const rows = await findAll.mock.results[locks[0].index].value
      expect(rows.map((r) => r.tenantId)).toEqual([tenantA.id, tenantB.id].sort((a, b) => a - b))
      expect(lockingCalls(findOne)).toHaveLength(0)
    } finally {
      findAll.mockRestore()
      findOne.mockRestore()
    }
  })

  test('ACTIVE → DEACTIVATED target: reactivates with the preserved role; mismatch rejected', async () => {
    const target = await member('d10deact', tenantA, 'cashier')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'staff', status: 'DEACTIVATED' })
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, role: 'cashier', reason: 'x' })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_CONFLICT', field: 'role' })
    expect((await membershipOf(target, tenantA)).status).toBe('ACTIVE')

    const res = await service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    expect(res).toMatchObject({ reactivated: true, created: false })
    expect(res.target).toMatchObject({ role: 'staff', status: 'ACTIVE' })
    expect(res.source.status).toBe('DEACTIVATED')
    expect(res.auditIds).toHaveLength(2)
  })

  test('ACTIVE → ACTIVE target: deactivates the source only; mismatch rejected', async () => {
    const target = await member('d10act', tenantA, 'cashier')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'staff', status: 'ACTIVE' })
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, role: 'cashier', reason: 'x' })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_CONFLICT', field: 'role' })
    const res = await service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    expect(res).toMatchObject({ created: false, reactivated: false, noOp: false })
    expect(res.auditIds).toHaveLength(1)
    expect(res.target.role).toBe('staff')
  })

  test('DEACTIVATED → ACTIVE is an idempotent retry: no audit, no revocation', async () => {
    const target = await member('d10idem', tenantA, 'cashier')
    await service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    const onB = await makeSession(target.id, tenantB.id)
    recordAudit.mockClear()
    const retry = await service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    expect(retry).toMatchObject({ noOp: true, auditIds: [], revokedSessionCount: 0 })
    expect(auditCalls()).toBe(0)
    expect(await isRevoked(onB)).toBe(false)
  })

  test('RETIRED or missing ends and non-ACTIVE sources are rejected without mutation', async () => {
    const retiredTarget = await member('d10rt', tenantA, 'cashier')
    await db.tenantMembership.create({ userId: retiredTarget.id, tenantId: tenantB.id, role: 'cashier', status: 'RETIRED' })
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: retiredTarget.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })

    const retiredSource = await member('d10rs', tenantA, 'cashier', 'RETIRED')
    await db.tenantMembership.create({ userId: retiredSource.id, tenantId: tenantB.id, role: 'cashier', status: 'DEACTIVATED' })
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: retiredSource.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
    expect((await membershipOf(retiredSource, tenantB)).status).toBe('DEACTIVATED')

    const inactiveSource = await member('d10is', tenantA, 'cashier', 'DEACTIVATED')
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: inactiveSource.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'TRANSITION_FORBIDDEN' })
    expect(await membershipOf(inactiveSource, tenantB)).toBeNull()

    const noSource = await member('d10ns', tenantB, 'cashier', 'DEACTIVATED')
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: noSource.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'fromTenantId' })
    expect((await membershipOf(noSource, tenantB)).status).toBe('DEACTIVATED')

    const noTenant = await member('d10nt', tenantA, 'cashier')
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: noTenant.id, fromTenantId: tenantA.id, toTenantId: NONEXISTENT_ID, reason: 'x' })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'toTenantId' })
    expect((await membershipOf(noTenant, tenantA)).status).toBe('ACTIVE')
    expect(auditCalls()).toBe(0)
  })

  test('a failure on either side rolls back the whole move', async () => {
    const target = await member('d10rb', tenantA, 'cashier')
    const onA = await makeSession(target.id, tenantA.id)

    // Target-side audit fails.
    recordAudit.mockRejectedValueOnce(new Error('target audit down'))
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toThrow('target audit down')

    // Source-side audit fails after the target was written.
    recordAudit.mockImplementationOnce(jest.requireActual('../utils/auditLog').recordAudit)
    recordAudit.mockRejectedValueOnce(new Error('source audit down'))
    await expect(
      service.moveMembership({ actor: platformActor, targetUserId: target.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    ).rejects.toThrow('source audit down')

    expect(await membershipOf(target, tenantB)).toBeNull()
    expect((await membershipOf(target, tenantA)).status).toBe('ACTIVE')
    expect(await isRevoked(onA)).toBe(false)
    expect(socket.disconnectSession).not.toHaveBeenCalled()
    expect(socket.disconnectUser).not.toHaveBeenCalled()
  })
})

describe('T-03A assignment primitives', () => {
  test('platform_admin grants an assignment with audit', async () => {
    const target = await makeUser('a1')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    const res = await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    expect(res.created).toBe(true)
    expect(res.assignment).toEqual(expect.objectContaining({ userId: target.id, tenantId: tenantA.id, storeId: storeA1.id }))
    expect(res).not.toHaveProperty('scope')
    const audit = await db.auditLog.findOne({ where: { entity: 'assignment', action: 'grant' }, order: [['id', 'DESC']] })
    expect(audit).not.toBeNull()
    expect(audit.store).toBe(storeA1.id)
    expect(audit.newValues).toEqual(expect.objectContaining({ storeId: storeA1.id }))
  })

  test('duplicate grant is an idempotent no-op', async () => {
    const target = await makeUser('a2')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier' })
    await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    recordAudit.mockClear()
    const res = await service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id })
    expect(res.noOp).toBe(true)
    expect(auditCalls()).toBe(0)
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
    expect(res.revokedSessionCount).toBe(1)
    expect(socket.disconnectSession).toHaveBeenCalledWith(onStore.sessionId)
    expect(socket.disconnectSession).toHaveBeenCalledTimes(1)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(0)
    expect(await isRevoked(onStore)).toBe(true)
    expect(await isRevoked(elsewhere)).toBe(false)
    const audit = await db.auditLog.findOne({ where: { entity: 'assignment', action: 'revoke' }, order: [['id', 'DESC']] })
    expect(audit.oldValues).toEqual(expect.objectContaining({ storeId: storeA1.id }))
    expect(audit.newValues).toBeNull()
    expect(audit.reason).toBe('off shift')
  })

  test('revoking a missing assignment is an idempotent no-op', async () => {
    const target = await makeUser('a4')
    const res = await service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: 'x' })
    expect(res.revoked).toBe(false)
    expect(res.noOp).toBe(true)
    expect(auditCalls()).toBe(0)
  })

  test('tenant_admin cannot grant into another tenant', async () => {
    const target = await makeUser('a5')
    await service.createMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, role: 'cashier' })
    await expect(
      service.grantAssignment({ actor: tenantAdminActor, targetUserId: target.id, storeId: storeB1.id })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'storeId' })
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
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'storeId' })
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
    await expect(
      service.grantAssignment({ actor: platformActor, targetUserId: NONEXISTENT_ID, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'userId' })
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
    expect(res.auditIds).toHaveLength(2)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(0)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA2.id } })).toBe(1)
    expect(res.revokedSessionCount).toBe(1)
    expect(await isRevoked(onOld)).toBe(true)
    expect(socket.disconnectSession).toHaveBeenCalledWith(onOld.sessionId)

    recordAudit.mockClear()
    const retry = await service.moveAssignment({ actor: platformActor, targetUserId: target.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' })
    expect(retry).toMatchObject({ moved: false, noOp: true, auditIds: [] })
    expect(auditCalls()).toBe(0)
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

describe('D15 reason and requestId contract', () => {
  test('reason is trimmed, required for reductions and capped at 500 characters', async () => {
    const target = await member('d15', tenantA, 'cashier')
    await assign(target, storeA1)
    for (const reason of [undefined, '', '   ']) {
      await expect(
        service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason })
      ).rejects.toMatchObject({ code: 'INVALID_REASON', field: 'reason' })
    }
    const tooLong = await caught(
      service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: 'x'.repeat(501) })
    )
    expect(tooLong).toMatchObject({ code: 'INVALID_REASON', field: 'reason' })
    expect(tooLong.name).toBe('Error')
    // Optional reasons are still length-checked.
    await expect(
      service.grantAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA2.id, reason: 'y'.repeat(501) })
    ).rejects.toMatchObject({ code: 'INVALID_REASON' })
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(1)

    const exact = 'z'.repeat(500)
    const res = await service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: `  ${exact}  ` })
    expect(res.revoked).toBe(true)
    expect((await db.auditLog.findByPk(res.auditId)).reason).toBe(exact)
  })

  test('requestId is capped at 64 characters with a canonical error', async () => {
    const target = await member('d15rid', tenantA, 'cashier')
    const exact = 'r'.repeat(64)
    const res = await service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'x', requestId: exact })
    expect(res.requestId).toBe(exact)
    expect((await db.auditLog.findByPk(res.auditId)).requestId).toBe(exact)

    const err = await caught(
      service.reactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, requestId: 'r'.repeat(65) })
    )
    expect(shape(err)).toEqual({ code: 'INVALID_REQUEST_ID', field: 'requestId', message: 'requestId must be at most 64 characters' })
    expect(err.name).toBe('Error')
    expect((await membershipOf(target, tenantA)).status).toBe('DEACTIVATED')
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
    expect(results.filter((r) => r.created)).toHaveLength(1)
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
    const final = await membershipOf(target, tenantA)
    expect(['ACTIVE', 'DEACTIVATED']).toContain(final.status)
  })

  test('concurrent revokes delete once and audit once', async () => {
    const target = await member('c4', tenantA, 'cashier')
    await assign(target, storeA1)
    const results = await Promise.all([
      service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: 'a' }),
      service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: 'b' })
    ])
    expect(results.filter((r) => r.revoked)).toHaveLength(1)
    expect(results.filter((r) => r.noOp)).toHaveLength(1)
    expect(auditCalls()).toBe(1)
  })

  test('revoke decides from the locked row: a concurrently deleted row is a no-op without audit', async () => {
    const target = await member('c5', tenantA, 'cashier')
    await assign(target, storeA1)
    const t = await db.sequelize.transaction()
    const row = await db.storeAssignment.findOne({ where: { userId: target.id, storeId: storeA1.id }, transaction: t, lock: t.LOCK.UPDATE })
    await row.destroy({ transaction: t })
    const pending = service.revokeAssignment({ actor: platformActor, targetUserId: target.id, storeId: storeA1.id, reason: 'x' })
    expect(await untilBlockedOrSettled(pending)).toBe('waiting')
    await t.commit()
    const res = await pending
    expect(res).toMatchObject({ revoked: false, noOp: true, auditId: null, revokedSessionCount: 0 })
    expect(auditCalls()).toBe(0)
  })

  test('a destination revoked during a move cannot make the move lose both assignments', async () => {
    const target = await member('c6', tenantA, 'cashier')
    await assign(target, storeA1)
    await assign(target, storeA2)
    const t = await db.sequelize.transaction()
    const destination = await db.storeAssignment.findOne({ where: { userId: target.id, storeId: storeA2.id }, transaction: t, lock: t.LOCK.UPDATE })
    await destination.destroy({ transaction: t })
    const pending = service.moveAssignment({ actor: platformActor, targetUserId: target.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' })
    expect(await untilBlockedOrSettled(pending)).toBe('waiting')
    await t.commit()
    const res = await pending
    expect(res).toMatchObject({ moved: true, created: true })
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA1.id } })).toBe(0)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA2.id } })).toBe(1)
  })
})

describe('D5-B concurrency: reductions of one user serialize on the full membership set', () => {
  test('a reduction waits for a concurrent change to another membership and sees its committed result', async () => {
    const target = await makeUser('d5ws')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'cashier', status: 'ACTIVE' })
    const unscoped = await makeSession(target.id)
    const onB = await makeSession(target.id, tenantB.id)

    // T1: a concurrent writer holds and reduces ONLY membership A (the shape
    // of the previous single-row reduction), left open mid-transaction.
    const t1 = await db.sequelize.transaction()
    const rowA = await db.tenantMembership.findOne({
      where: { userId: target.id, tenantId: tenantA.id },
      transaction: t1,
      lock: t1.LOCK.UPDATE
    })
    rowA.status = 'DEACTIVATED'
    await rowA.save({ transaction: t1 })

    // T2: the service reduces B while T1 is open. Before the fix it did not
    // block, saw A still ACTIVE and left the tenant-less session alive.
    const pending = service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, reason: 'x' })
    const barrier = await untilBlockedOrSettled(pending)
    await t1.commit()
    expect(barrier).toBe('waiting')
    const res = await pending

    // Once T1 committed, B was the user's last effective membership.
    expect(res.revokedSessionCount).toBe(2)
    expect(await isRevoked(unscoped)).toBe(true)
    expect(await isRevoked(onB)).toBe(true)
    expect(socket.disconnectSession).toHaveBeenCalledWith(unscoped.sessionId)
    expect(socket.disconnectUser).not.toHaveBeenCalled()
  })

  test('concurrent reductions of two memberships: no deadlock, no surviving tenant-less session', async () => {
    for (let round = 0; round < 5; round += 1) {
      const target = await makeUser(`d5cc${round}`)
      await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
      await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'store_admin', status: 'ACTIVE' })
      const unscoped = await makeSession(target.id)
      const onA = await makeSession(target.id, tenantA.id)
      const onB = await makeSession(target.id, tenantB.id)
      recordAudit.mockClear()

      const results = await Promise.all([
        service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'a' }),
        service.changeMembershipRole({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, role: 'staff', reason: 'b' })
      ])

      expect(results.every((r) => r.noOp === false)).toBe(true)
      expect(await membershipOf(target, tenantA)).toMatchObject({ status: 'DEACTIVATED' })
      expect(await membershipOf(target, tenantB)).toMatchObject({ status: 'ACTIVE', role: 'staff' })
      expect(await isRevoked(onA)).toBe(true)
      expect(await isRevoked(onB)).toBe(true)
      expect(auditCalls()).toBe(2)
      // Serialized either way. B stays effective (downgraded, still ACTIVE),
      // so A's deactivation never sees A as sole and revokes only onA. B's
      // downgrade revokes the tenant-less session exactly when it ran after
      // A's deactivation committed (B was then the sole effective membership).
      expect(results[0].revokedSessionCount).toBe(1)
      expect(await isRevoked(unscoped)).toBe(results[1].revokedSessionCount === 2)
    }

    for (let round = 0; round < 5; round += 1) {
      const target = await makeUser(`d5cd${round}`)
      await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
      await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'cashier', status: 'ACTIVE' })
      const unscoped = await makeSession(target.id)
      recordAudit.mockClear()

      const results = await Promise.all([
        service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'a' }),
        service.retireMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, reason: 'b' })
      ])

      expect(results.map((r) => r.membership.status).sort()).toEqual(['DEACTIVATED', 'RETIRED'])
      expect(auditCalls()).toBe(2)
      // No effective membership remains: whichever reduction ran second saw
      // the other committed and revoked the tenant-less session.
      expect(await isRevoked(unscoped)).toBe(true)
      expect(results.reduce((sum, r) => sum + r.revokedSessionCount, 0)).toBe(1)
    }
  })

  test('sessions pinned to an untouched tenant survive concurrent reductions elsewhere', async () => {
    const tenantC = await db.tenant.create({ code: `${uid()}_C`, name: `${P}Tenant C` })
    const target = await makeUser('d5cc_c')
    for (const tenant of [tenantA, tenantB, tenantC]) {
      await db.tenantMembership.create({ userId: target.id, tenantId: tenant.id, role: 'cashier', status: 'ACTIVE' })
    }
    const unscoped = await makeSession(target.id)
    const onC = await makeSession(target.id, tenantC.id)
    await Promise.all([
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, reason: 'a' }),
      service.deactivateMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, reason: 'b' })
    ])
    expect(await isRevoked(onC)).toBe(false)
    expect(await isRevoked(unscoped)).toBe(false)
  })

  test('reductions take only the full-set lock, never a single-row membership lock first', async () => {
    const target = await makeUser('d5lock')
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
    await db.tenantMembership.create({ userId: target.id, tenantId: tenantB.id, role: 'cashier', status: 'ACTIVE' })
    const findAll = jest.spyOn(db.tenantMembership, 'findAll')
    const findOne = jest.spyOn(db.tenantMembership, 'findOne')
    try {
      await service.changeMembershipRole({ actor: platformActor, targetUserId: target.id, tenantId: tenantA.id, role: 'cashier', reason: 'x' })
      await service.retireMembership({ actor: platformActor, targetUserId: target.id, tenantId: tenantB.id, reason: 'x' })
      const locks = lockingCalls(findAll)
      expect(locks).toHaveLength(2)
      for (const { opts } of locks) {
        expect(opts.where).toEqual({ userId: target.id })
        expect(opts.order).toEqual([['tenantId', 'ASC']])
      }
      expect(lockingCalls(findOne)).toHaveLength(0)
    } finally {
      findAll.mockRestore()
      findOne.mockRestore()
    }
  })
})

describe('transaction-aware canonical resolver', () => {
  test('same result with or without a transaction for committed state', async () => {
    const user = await member('rz1', tenantA, 'cashier')
    await assign(user, storeA1)
    const args = { userId: user.id, activeTenantId: tenantA.id, activeStoreId: storeA1.id }
    const without = await resolveAuthorizationContext(db, args)
    const t = await db.sequelize.transaction()
    try {
      expect(await resolveAuthorizationContext(db, { ...args, transaction: t })).toEqual(without)
    } finally {
      await t.rollback()
    }
    expect(without).toMatchObject({ eligible: true, activeTenantId: tenantA.id, activeStoreId: storeA1.id, assignedStoreIds: [storeA1.id] })
  })

  test('every read goes through the supplied transaction and sees its uncommitted writes', async () => {
    const user = await member('rz2', tenantA, 'cashier')
    const legacyPlatform = await db.user.create({
      userName: `${uid()}_rzp`,
      email: `${uid()}_rzp@test.com`,
      roleType: 'super_admin',
      store: null,
      status: 'active',
      password: 'Test12345'
    })
    const t = await db.sequelize.transaction()
    try {
      // Tenant roster + assignment reads.
      await db.storeAssignment.create({ userId: user.id, tenantId: tenantA.id, storeId: storeA2.id }, { transaction: t })
      const storeArgs = { userId: user.id, activeTenantId: tenantA.id, activeStoreId: storeA2.id }
      expect((await resolveAuthorizationContext(db, { ...storeArgs, transaction: t })).activeStoreId).toBe(storeA2.id)
      expect(await resolveAuthorizationContext(db, storeArgs)).toMatchObject({ activeStoreId: null, reason: 'unassigned-store' })

      // Platform-wide store existence read.
      const draft = await db.location.create({ name: `${P}TX`, status: 'draft', tenantId: null }, { transaction: t })
      const platformArgs = { userId: legacyPlatform.id, activeStoreId: draft.id }
      expect((await resolveAuthorizationContext(db, { ...platformArgs, transaction: t })).activeStoreId).toBe(draft.id)
      expect(await resolveAuthorizationContext(db, platformArgs)).toMatchObject({ activeStoreId: null, reason: 'foreign-store' })

      // Membership read.
      await db.tenantMembership.update({ status: 'DEACTIVATED' }, { where: { userId: user.id, tenantId: tenantA.id }, transaction: t })
      expect((await resolveAuthorizationContext(db, { userId: user.id, transaction: t })).effectiveTenantIds).toEqual([])
      expect((await resolveAuthorizationContext(db, { userId: user.id })).effectiveTenantIds).toEqual([tenantA.id])

      // Account read.
      await db.user.update({ disabledAt: new Date() }, { where: { id: user.id }, transaction: t })
      expect((await resolveAuthorizationContext(db, { userId: user.id, transaction: t })).reason).toBe('ineligible-account')
      expect((await resolveAuthorizationContext(db, { userId: user.id })).eligible).toBe(true)
    } finally {
      await t.rollback()
    }
  })
})

describe('assignment move contract', () => {
  test('source absent + destination present is an idempotent no-op', async () => {
    const target = await member('mvnoop', tenantA, 'cashier')
    await assign(target, storeA2)
    const onSource = await makeSession(target.id, tenantA.id, storeA1.id)
    const res = await service.moveAssignment({
      actor: platformActor,
      targetUserId: target.id,
      fromStoreId: storeA1.id,
      toStoreId: storeA2.id,
      reason: 'x'
    })
    expect(res).toMatchObject({ moved: false, noOp: true, created: false, auditIds: [], revokedSessionCount: 0 })
    expect(res.assignment).toMatchObject({ userId: target.id, storeId: storeA2.id })
    expect(auditCalls()).toBe(0)
    expect(await auditRowsFor(res.requestId)).toBe(0)
    expect(await db.storeAssignment.count({ where: { userId: target.id, storeId: storeA2.id } })).toBe(1)
    expect(await db.storeAssignment.count({ where: { userId: target.id } })).toBe(1)
    expect(await isRevoked(onSource)).toBe(false)
    expect(socket.disconnectSession).not.toHaveBeenCalled()
  })

  test('a move waiting on a concurrently revoked source follows the post-lock state', async () => {
    // Destination absent → canonical RESOURCE_NOT_FOUND, nothing created.
    const lone = await member('mvrace1', tenantA, 'cashier')
    await assign(lone, storeA1)
    const t1 = await db.sequelize.transaction()
    const source1 = await db.storeAssignment.findOne({ where: { userId: lone.id, storeId: storeA1.id }, transaction: t1, lock: t1.LOCK.UPDATE })
    await source1.destroy({ transaction: t1 })
    const pending1 = service.moveAssignment({ actor: platformActor, targetUserId: lone.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' })
    const barrier1 = await untilBlockedOrSettled(pending1)
    await t1.commit()
    expect(barrier1).toBe('waiting')
    await expect(pending1).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'fromStoreId' })
    expect(await db.storeAssignment.count({ where: { userId: lone.id } })).toBe(0)

    // Destination present → idempotent no-op, destination kept.
    const both = await member('mvrace2', tenantA, 'cashier')
    await assign(both, storeA1)
    await assign(both, storeA2)
    const t2 = await db.sequelize.transaction()
    const source2 = await db.storeAssignment.findOne({ where: { userId: both.id, storeId: storeA1.id }, transaction: t2, lock: t2.LOCK.UPDATE })
    await source2.destroy({ transaction: t2 })
    const pending2 = service.moveAssignment({ actor: platformActor, targetUserId: both.id, fromStoreId: storeA1.id, toStoreId: storeA2.id, reason: 'x' })
    const barrier2 = await untilBlockedOrSettled(pending2)
    await t2.commit()
    expect(barrier2).toBe('waiting')
    expect(await pending2).toMatchObject({ moved: false, noOp: true, auditIds: [] })
    expect(await db.storeAssignment.count({ where: { userId: both.id, storeId: storeA2.id } })).toBe(1)
    expect(await db.storeAssignment.count({ where: { userId: both.id, storeId: storeA1.id } })).toBe(0)
    expect(auditCalls()).toBe(0)
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
    // tenantA, so a tenant B admin cannot see it.
    await expect(
      service.grantAssignment({ actor: { ...tenantAdminActor, tenantId: tenantB.id }, targetUserId: target.id, storeId: storeA1.id })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', field: 'storeId' })
  })

  test('service never consults JWT or legacy roleType/store claims, nor returns resolved scope', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../api/service/membershipAssignmentService.js'), 'utf8')
    expect(src).not.toMatch(/jsonwebtoken/)
    expect(src).not.toMatch(/jwt\.verify/)
    expect(src).not.toMatch(/req\.user/)
    expect(src).not.toMatch(/req\.body/)
    expect(src).not.toMatch(/roleType/)
    expect(src).not.toMatch(/bulkCreate/)
    expect(src).not.toMatch(/\.raw\(/)
    expect(src).not.toMatch(/sequelize\.query/)
    expect(src).not.toMatch(/postMutationScope/)
    expect(src).toMatch(/recordAudit/)
    expect(src).toMatch(/sequelize\.transaction/)
  })
})
