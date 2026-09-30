'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// T-03B: canonical membership / assignment HTTP API, D8 effective scope,
// DR-03 Q8 reactivation freshness, switch-race serialization, available
// roles. Real Postgres test DB; T03B_ fixtures removed in afterAll.
const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const mw = require('../utils/authorizationContextMiddleware')
const { resolveAuthorizationContext, TARGET_ROLES } = require('../utils/authContext')
const service = require('../api/service/membershipAssignmentService')
const socketService = require('../api/service/socket')

const JWT_SECRET = process.env.JWT_SECRET_KEY
const P = 'T03B_'
const NONEXISTENT_ID = 2000000000
const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const created = { users: [], tenants: [], stores: [] }

let tenantA
let tenantB
let storeA1
let storeA2
let storeB1

let platformLegacy // global super_admin, no membership
let platformMember // platform_admin membership in A, session pinned to A
let boundSuper // store-bound super_admin, no membership
let tenantAdminA
let storeAdminA
let storeAdminMulti // store_admin A, assigned A1 + A2, session selects A1
let cashierA
let staffA

let tgtCashier // cashier A, assigned A1 + A2
let tgtMulti // cashier A + cashier B, assigned A1 + B1
let tgtOnlyB // cashier B only, assigned B1
let tgtInactive // cashier A DEACTIVATED, assigned A1 (recorded, ineffective)
let tgtRetired // staff A RETIRED
let tgtPeerStoreAdmin // store_admin A
let tgtUnassigned // staff A, no assignment

const tokens = {}

const mkUser = async (key, roleType = 'user', store = null) => {
  const user = await db.user.create({
    userName: `${P}${key}_${uniq()}`,
    email: `${P}${key}_${uniq()}@test.com`,
    roleType,
    store: store ? store.id : null,
    status: 'active',
    password: 'Test12345'
  })
  created.users.push(user.id)
  return user
}

const member = (user, tenant, role, status = 'ACTIVE') =>
  db.tenantMembership.create({ userId: user.id, tenantId: tenant.id, role, status })

const assign = (user, store) => db.storeAssignment.create({ userId: user.id, tenantId: store.tenantId, storeId: store.id })

const sessionFor = async (user, tenantId = null, storeId = null) => {
  const s = await mw.createContextSession(db, { userId: user.id })
  if (tenantId != null) await mw.switchSessionTenant(db, s.sessionId, user.id, tenantId)
  if (storeId != null) await mw.switchSessionStore(db, s.sessionId, user.id, storeId)
  return { id: s.id, sessionId: s.sessionId, token: jwt.sign({ id: user.id, sessionId: s.sessionId }, JWT_SECRET) }
}

const http = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`)

const platformActor = () => ({ userId: platformLegacy.id, role: 'platform_admin' })

const sessionRow = (id) => db.authorizationContextSession.findByPk(id)

// Deterministic transaction barrier: 'waiting' once another backend of the
// test database is blocked on a lock, 'settled' if the operation finished
// without ever blocking. Polls lock state instead of sleeping.
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

// Every SQL statement issued while `fn` runs, with literals normalized.
const captureSql = async (fn) => {
  const previous = db.sequelize.options.logging
  const statements = []
  db.sequelize.options.logging = (sql) =>
    statements.push(
      String(sql)
        .replace(/'[^']*'/g, "'?'")
        .replace(/\b\d+\b/g, '?')
    )
  try {
    await fn()
  } finally {
    db.sequelize.options.logging = previous
  }
  return statements
}

const FORBIDDEN_DTO_KEYS = [
  'sessionId',
  'viaLegacyClaims',
  'legacySuperAdminScope',
  'reason',
  'tenantStoreIds',
  'effectiveTenantIds',
  'eligible',
  'accountStatus',
  'isPlatformAdmin',
  'token'
]

const expectCleanDto = (body) => {
  const text = JSON.stringify(body)
  for (const key of FORBIDDEN_DTO_KEYS) expect(text).not.toContain(`"${key}"`)
}

beforeAll(async () => {
  tenantA = await db.tenant.create({ code: `${P}A_${uniq()}`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B_${uniq()}`, name: `${P}Tenant B` })
  created.tenants.push(tenantA.id, tenantB.id)
  storeA1 = await db.location.create({ name: `${P}A1`, status: 'active', tenantId: tenantA.id })
  storeA2 = await db.location.create({ name: `${P}A2`, status: 'active', tenantId: tenantA.id })
  storeB1 = await db.location.create({ name: `${P}B1`, status: 'active', tenantId: tenantB.id })
  created.stores.push(storeA1.id, storeA2.id, storeB1.id)

  platformLegacy = await mkUser('platform', 'super_admin', null)
  platformMember = await mkUser('platmember')
  await member(platformMember, tenantA, 'platform_admin')
  boundSuper = await mkUser('boundsuper', 'super_admin', storeA1)
  tenantAdminA = await mkUser('tadmin')
  await member(tenantAdminA, tenantA, 'tenant_admin')
  storeAdminA = await mkUser('sadmin')
  await member(storeAdminA, tenantA, 'store_admin')
  await assign(storeAdminA, storeA1)
  cashierA = await mkUser('cashier')
  await member(cashierA, tenantA, 'cashier')
  await assign(cashierA, storeA1)
  staffA = await mkUser('staff')
  await member(staffA, tenantA, 'staff')

  tgtCashier = await mkUser('tgtcashier')
  await member(tgtCashier, tenantA, 'cashier')
  await assign(tgtCashier, storeA1)
  await assign(tgtCashier, storeA2)
  tgtMulti = await mkUser('tgtmulti')
  await member(tgtMulti, tenantA, 'cashier')
  await member(tgtMulti, tenantB, 'cashier')
  await assign(tgtMulti, storeA1)
  await assign(tgtMulti, storeB1)
  tgtOnlyB = await mkUser('tgtonlyb')
  await member(tgtOnlyB, tenantB, 'cashier')
  await assign(tgtOnlyB, storeB1)
  tgtInactive = await mkUser('tgtinactive')
  await member(tgtInactive, tenantA, 'cashier', 'DEACTIVATED')
  await assign(tgtInactive, storeA1)
  tgtRetired = await mkUser('tgtretired')
  await member(tgtRetired, tenantA, 'staff', 'RETIRED')
  tgtPeerStoreAdmin = await mkUser('tgtpeersa')
  await member(tgtPeerStoreAdmin, tenantA, 'store_admin')
  await assign(tgtPeerStoreAdmin, storeA1)
  tgtUnassigned = await mkUser('tgtunassigned')
  await member(tgtUnassigned, tenantA, 'staff')

  tokens.platform = (await sessionFor(platformLegacy)).token
  tokens.platformMember = (await sessionFor(platformMember, tenantA.id)).token
  tokens.boundSuper = (await sessionFor(boundSuper)).token
  tokens.tenantAdmin = (await sessionFor(tenantAdminA)).token
  tokens.storeAdmin = (await sessionFor(storeAdminA, tenantA.id, storeA1.id)).token
  // Same store_admin, no store selected (implicit tenant A, activeStoreId null).
  tokens.storeAdminNoStore = (await sessionFor(storeAdminA)).token
  storeAdminMulti = await mkUser('sadminmulti')
  await member(storeAdminMulti, tenantA, 'store_admin')
  await assign(storeAdminMulti, storeA1)
  await assign(storeAdminMulti, storeA2)
  tokens.storeAdminMulti = (await sessionFor(storeAdminMulti, tenantA.id, storeA1.id)).token
  tokens.cashier = (await sessionFor(cashierA)).token
  tokens.staff = (await sessionFor(staffA)).token
}, 60000)

afterAll(async () => {
  const userIds = created.users
  await db.authorizationContextSession.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  await db.auditLog.destroy({ where: { userId: userIds }, __auditMaintenance: true }).catch(() => {})
  await db.storeAssignment.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: created.stores }, force: true }).catch(() => {})
  await db.user.destroy({ where: { id: userIds }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: created.tenants }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 60000)

// ---------------------------------------------------------------------------
// DR-03 Q8 reactivation freshness
// ---------------------------------------------------------------------------

describe('DR-03 Q8 reactivation freshness', () => {
  test('session authentication time and reactivatedAt come from the database clock', async () => {
    const user = await mkUser('dbclock')
    const t = await db.sequelize.transaction()
    try {
      const s = await mw.createContextSession(db, { userId: user.id, transaction: t })
      const [[{ now }]] = await db.sequelize.query('SELECT NOW() AS now', { transaction: t })
      expect(s.createdAt.getTime()).toBe(new Date(now).getTime())
    } finally {
      await t.rollback()
    }
    const src = require('fs').readFileSync(require('path').join(__dirname, '../api/service/membershipAssignmentService.js'), 'utf8')
    expect(src).toMatch(/reactivatedAt = db\.sequelize\.fn\('NOW'\)/)
  })

  test('only DEACTIVATED → ACTIVE stamps reactivatedAt (create, role change and assignments never do)', async () => {
    const user = await mkUser('stamp')
    const fresh = await service.createMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, role: 'staff' })
    expect(fresh.membership.reactivatedAt).toBeNull()
    await service.changeMembershipRole({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, role: 'cashier', reason: 'x' })
    await service.grantAssignment({ actor: platformActor(), targetUserId: user.id, storeId: storeA1.id })
    await service.revokeAssignment({ actor: platformActor(), targetUserId: user.id, storeId: storeA1.id, reason: 'x' })
    expect((await db.tenantMembership.findOne({ where: { userId: user.id, tenantId: tenantA.id } })).reactivatedAt).toBeNull()

    await service.deactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, reason: 'x' })
    const viaReactivate = await service.reactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id })
    expect(viaReactivate.membership.reactivatedAt).not.toBeNull()

    await service.deactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, reason: 'x' })
    const viaCreate = await service.createMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, role: 'cashier' })
    expect(viaCreate.reactivated).toBe(true)
    expect(new Date(viaCreate.membership.reactivatedAt).getTime()).toBeGreaterThanOrEqual(new Date(viaReactivate.membership.reactivatedAt).getTime())

    const mover = await mkUser('stampmove')
    await member(mover, tenantA, 'cashier')
    await member(mover, tenantB, 'cashier', 'DEACTIVATED')
    const moved = await service.moveMembership({ actor: platformActor(), targetUserId: mover.id, fromTenantId: tenantA.id, toTenantId: tenantB.id, reason: 'x' })
    expect(moved.reactivated).toBe(true)
    expect(moved.target.reactivatedAt).not.toBeNull()
    expect(moved.source.reactivatedAt).toBeNull()
  })

  test('a newly granted membership works for an existing session (T-03 Q11)', async () => {
    const user = await mkUser('newgrant')
    const s = await sessionFor(user)
    await service.createMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, role: 'cashier' })
    const res = await http('get', '/effective-scope', s.token)
    expect(res.status).toBe(200)
    expect(res.body.data.context).toMatchObject({ activeTenantId: tenantA.id, role: 'cashier' })
  })

  test('a session authenticated before a reactivation gains nothing from it; a fresh one does', async () => {
    const user = await mkUser('reactivated')
    await member(user, tenantA, 'cashier')
    await assign(user, storeA1)
    await service.deactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, reason: 'x' })
    const during = await sessionFor(user) // logged in while A was DEACTIVATED
    await service.reactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id })

    // Middleware (implicit default), switch probe, socket join, self scope.
    const ctxRes = await http('get', '/auth/context', during.token)
    expect(ctxRes.status).toBe(200)
    expect(ctxRes.body.data.context.activeTenantId).toBeNull()
    await expect(mw.switchSessionTenant(db, during.sessionId, user.id, tenantA.id)).rejects.toThrow(/CONTEXT_TENANT_FORBIDDEN/)
    expect(await socketService.canJoinStoreCanonical({ user: { id: user.id, sessionId: during.sessionId } }, storeA1.id)).toBe(false)
    const scope = await http('get', '/effective-scope', during.token)
    expect(scope.body.data.memberships).toEqual([{ tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' }])
    expect(scope.body.data.assignments).toEqual([{ tenantId: tenantA.id, storeId: storeA1.id, effective: false }])

    // Resolver without authenticatedAt keeps its existing semantics.
    expect((await resolveAuthorizationContext(db, { userId: user.id })).effectiveTenantIds).toEqual([tenantA.id])

    const fresh = await sessionFor(user)
    const freshCtx = await http('get', '/auth/context', fresh.token)
    expect(freshCtx.body.data.context.activeTenantId).toBe(tenantA.id)
    expect(await socketService.canJoinStoreCanonical({ user: { id: user.id, sessionId: fresh.sessionId } }, storeA1.id)).toBe(true)
  })

  test('reactivating A does not invalidate a session using B', async () => {
    const user = await mkUser('multifresh')
    await member(user, tenantA, 'cashier')
    await member(user, tenantB, 'cashier')
    const onB = await sessionFor(user, tenantB.id)
    await service.deactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, reason: 'x' })
    await service.reactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id })

    const res = await http('get', '/auth/context', onB.token)
    expect(res.status).toBe(200)
    expect(res.body.data.context).toMatchObject({ activeTenantId: tenantB.id, activeRole: 'cashier' })
    // The surviving session still cannot re-acquire the reactivated tenant.
    await expect(mw.switchSessionTenant(db, onB.sessionId, user.id, tenantA.id)).rejects.toThrow(/CONTEXT_TENANT_FORBIDDEN/)
  })

  test('role and assignment changes never trigger reactivation freshness', async () => {
    const user = await mkUser('rolefresh')
    await member(user, tenantA, 'staff')
    const s = await sessionFor(user)
    await service.changeMembershipRole({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, role: 'cashier', reason: 'promotion' })
    await service.grantAssignment({ actor: platformActor(), targetUserId: user.id, storeId: storeA2.id })
    const res = await http('get', '/effective-scope', s.token)
    expect(res.body.data.context).toMatchObject({ activeTenantId: tenantA.id, role: 'cashier' })
    expect(res.body.data.assignments).toEqual([{ tenantId: tenantA.id, storeId: storeA2.id, effective: true }])
    await service.revokeAssignment({ actor: platformActor(), targetUserId: user.id, storeId: storeA2.id, reason: 'x' })
    expect((await http('get', '/effective-scope', s.token)).body.data.context.activeTenantId).toBe(tenantA.id)
  })
})

// ---------------------------------------------------------------------------
// Switch race serialization
// ---------------------------------------------------------------------------

describe('switch race serialization', () => {
  test('a tenant switch waits for a concurrent membership reduction and is then denied', async () => {
    const user = await mkUser('raceT')
    await member(user, tenantA, 'cashier')
    await member(user, tenantB, 'cashier')
    const s = await sessionFor(user)

    const t1 = await db.sequelize.transaction()
    const rowA = await db.tenantMembership.findOne({
      where: { userId: user.id, tenantId: tenantA.id },
      transaction: t1,
      lock: t1.LOCK.UPDATE
    })
    rowA.status = 'DEACTIVATED'
    await rowA.save({ transaction: t1 })
    const pending = mw.switchSessionTenant(db, s.sessionId, user.id, tenantA.id)
    const barrier = await untilBlockedOrSettled(pending)
    await t1.commit()
    expect(barrier).toBe('waiting')
    await expect(pending).rejects.toThrow(/CONTEXT_TENANT_FORBIDDEN/)
    expect((await sessionRow(s.id)).activeTenantId).toBeNull()
  })

  test('a store switch waits for a concurrent assignment revoke and is then denied', async () => {
    const user = await mkUser('raceS')
    await member(user, tenantA, 'cashier')
    await assign(user, storeA1)
    const s = await sessionFor(user, tenantA.id)

    const t1 = await db.sequelize.transaction()
    const row = await db.storeAssignment.findOne({
      where: { userId: user.id, storeId: storeA1.id },
      transaction: t1,
      lock: t1.LOCK.UPDATE
    })
    await row.destroy({ transaction: t1 })
    const pending = mw.switchSessionStore(db, s.sessionId, user.id, storeA1.id)
    const barrier = await untilBlockedOrSettled(pending)
    await t1.commit()
    expect(barrier).toBe('waiting')
    await expect(pending).rejects.toThrow(/CONTEXT_STORE_FORBIDDEN/)
    expect((await sessionRow(s.id)).activeStoreId).toBeNull()
  })

  test('lock order is membership set → assignment → session', async () => {
    const user = await mkUser('lockorder')
    await member(user, tenantA, 'cashier')
    await assign(user, storeA1)
    const s = await sessionFor(user, tenantA.id)
    const memberships = jest.spyOn(db.tenantMembership, 'findAll')
    const assignments = jest.spyOn(db.storeAssignment, 'findOne')
    const sessions = jest.spyOn(db.authorizationContextSession, 'findOne')
    const firstLock = (spy) => {
      const index = spy.mock.calls.findIndex(([opts]) => opts && opts.lock)
      return index === -1 ? null : spy.mock.invocationCallOrder[index]
    }
    try {
      await mw.switchSessionStore(db, s.sessionId, user.id, storeA1.id)
      const m = firstLock(memberships)
      const a = firstLock(assignments)
      const sess = firstLock(sessions)
      expect(m).not.toBeNull()
      expect(m).toBeLessThan(a)
      expect(a).toBeLessThan(sess)
      const lockedMembershipQuery = memberships.mock.calls.find(([opts]) => opts && opts.lock)[0]
      expect(lockedMembershipQuery.order).toEqual([['tenantId', 'ASC']])

      memberships.mockClear()
      sessions.mockClear()
      await mw.switchSessionTenant(db, s.sessionId, user.id, tenantA.id)
      expect(firstLock(memberships)).toBeLessThan(firstLock(sessions))
    } finally {
      memberships.mockRestore()
      assignments.mockRestore()
      sessions.mockRestore()
    }
  })

  test('concurrent switch + reduction never commits an unauthorized session context', async () => {
    for (let round = 0; round < 5; round += 1) {
      const user = await mkUser(`racep${round}`)
      await member(user, tenantA, 'cashier')
      await member(user, tenantB, 'cashier')
      const s = await sessionFor(user)
      await Promise.allSettled([
        mw.switchSessionTenant(db, s.sessionId, user.id, tenantA.id),
        service.deactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id, reason: 'x' })
      ])
      const row = await sessionRow(s.id)
      // Either the switch lost (never pinned to A) or it won and the
      // reduction then revoked the pinned session.
      expect(row.revokedAt == null && row.activeTenantId === tenantA.id).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// D8 effective scope
// ---------------------------------------------------------------------------

describe('D8 effective scope visibility', () => {
  test('self: omitted userId and own userId are the same full self view', async () => {
    const omitted = await http('get', '/effective-scope', tokens.cashier)
    const own = await http('get', `/effective-scope?userId=${cashierA.id}`, tokens.cashier)
    expect(omitted.status).toBe(200)
    expect(own.body).toEqual(omitted.body)
    expect(omitted.body).toMatchObject({
      success: true,
      data: {
        user: { id: cashierA.id, userName: cashierA.userName },
        memberships: [{ tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' }],
        assignments: [{ tenantId: tenantA.id, storeId: storeA1.id, effective: true }],
        context: { activeTenantId: tenantA.id, activeStoreId: null, role: 'cashier', permissions: [] }
      }
    })
    expectCleanDto(omitted.body)
  })

  test('cashier / staff: any other target is 403, whether or not it exists', async () => {
    for (const token of [tokens.cashier, tokens.staff]) {
      const existing = await http('get', `/effective-scope?userId=${tgtCashier.id}`, token)
      const missing = await http('get', `/effective-scope?userId=${NONEXISTENT_ID}`, token)
      const malformed = await http('get', '/effective-scope?userId=abc', token)
      expect(existing.status).toBe(403)
      expect(existing.body).toEqual({ success: false, code: 'FORBIDDEN', field: 'userId', message: 'actor may only view its own scope' })
      expect(missing.body).toEqual(existing.body)
      expect(malformed.body).toEqual(existing.body)
    }
  })

  test('platform without an active tenant sees every tenant of the target', async () => {
    const res = await http('get', `/effective-scope?userId=${tgtMulti.id}`, tokens.platform)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      user: { id: tgtMulti.id, userName: tgtMulti.userName },
      memberships: [
        { tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' },
        { tenantId: tenantB.id, role: 'cashier', status: 'ACTIVE' }
      ],
      assignments: [
        { tenantId: tenantA.id, storeId: storeA1.id, effective: true },
        { tenantId: tenantB.id, storeId: storeB1.id, effective: true }
      ]
    })
    expectCleanDto(res.body)
    expect((await http('get', `/effective-scope?userId=${NONEXISTENT_ID}`, tokens.platform)).status).toBe(404)
  })

  test('platform with an active tenant is confined to that tenant', async () => {
    const res = await http('get', `/effective-scope?userId=${tgtMulti.id}`, tokens.platformMember)
    expect(res.status).toBe(200)
    expect(res.body.data.memberships).toEqual([{ tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' }])
    expect(res.body.data.assignments).toEqual([{ tenantId: tenantA.id, storeId: storeA1.id, effective: true }])
    expect((await http('get', `/effective-scope?userId=${tgtOnlyB.id}`, tokens.platformMember)).status).toBe(404)
  })

  test('tenant_admin: same-tenant members of any status; foreign data hidden', async () => {
    const multi = await http('get', `/effective-scope?userId=${tgtMulti.id}`, tokens.tenantAdmin)
    expect(multi.body.data).toEqual({
      user: { id: tgtMulti.id, userName: tgtMulti.userName },
      memberships: [{ tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' }],
      assignments: [{ tenantId: tenantA.id, storeId: storeA1.id, effective: true }]
    })
    const inactive = await http('get', `/effective-scope?userId=${tgtInactive.id}`, tokens.tenantAdmin)
    expect(inactive.body.data.memberships).toEqual([{ tenantId: tenantA.id, role: 'cashier', status: 'DEACTIVATED' }])
    expect(inactive.body.data.assignments).toEqual([{ tenantId: tenantA.id, storeId: storeA1.id, effective: false }])
    const retired = await http('get', `/effective-scope?userId=${tgtRetired.id}`, tokens.tenantAdmin)
    expect(retired.body.data.memberships).toEqual([{ tenantId: tenantA.id, role: 'staff', status: 'RETIRED' }])
    expect((await http('get', `/effective-scope?userId=${tgtOnlyB.id}`, tokens.tenantAdmin)).status).toBe(404)
  })

  test('store_admin: lower-ranked same-tenant members only; assignments limited to its stores', async () => {
    const cashier = await http('get', `/effective-scope?userId=${tgtCashier.id}`, tokens.storeAdmin)
    expect(cashier.status).toBe(200)
    expect(cashier.body.data.assignments).toEqual([{ tenantId: tenantA.id, storeId: storeA1.id, effective: true }])
    const unassigned = await http('get', `/effective-scope?userId=${tgtUnassigned.id}`, tokens.storeAdmin)
    expect(unassigned.status).toBe(200)
    expect(unassigned.body.data).toEqual({
      user: { id: tgtUnassigned.id, userName: tgtUnassigned.userName },
      memberships: [{ tenantId: tenantA.id, role: 'staff', status: 'ACTIVE' }],
      assignments: []
    })
    const inactive = await http('get', `/effective-scope?userId=${tgtInactive.id}`, tokens.storeAdmin)
    expect(inactive.body.data.memberships[0].status).toBe('DEACTIVATED')
    for (const hidden of [tgtPeerStoreAdmin, tenantAdminA, tgtOnlyB]) {
      const res = await http('get', `/effective-scope?userId=${hidden.id}`, tokens.storeAdmin)
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ success: false, code: 'RESOURCE_NOT_FOUND', field: 'userId', message: 'userId not found' })
    }
  })

  test('invisible and nonexistent targets are indistinguishable (status, body, query shape)', async () => {
    for (const [token, invisible] of [
      [tokens.tenantAdmin, tgtOnlyB],
      [tokens.storeAdmin, tgtPeerStoreAdmin],
      [tokens.storeAdmin, tgtOnlyB]
    ]) {
      let a
      let b
      const sqlA = await captureSql(async () => {
        a = await http('get', `/effective-scope?userId=${invisible.id}`, token)
      })
      const sqlB = await captureSql(async () => {
        b = await http('get', `/effective-scope?userId=${NONEXISTENT_ID}`, token)
      })
      expect(a.status).toBe(404)
      expect(b.status).toBe(a.status)
      expect(b.body).toEqual(a.body)
      expect(sqlB).toEqual(sqlA)
    }
  })
})

// ---------------------------------------------------------------------------
// Available canonical membership roles
// ---------------------------------------------------------------------------

describe('available roles', () => {
  test('platform gets all five, tenant_admin three; others are denied', async () => {
    const platform = await http('get', '/memberships/available-roles', tokens.platform)
    expect(platform.status).toBe(200)
    expect(platform.body.data.roles.map((r) => r.code)).toEqual(TARGET_ROLES)
    expect(platform.body.data.roles.every((r) => typeof r.name === 'string' && r.name.length > 0)).toBe(true)
    const tenantAdmin = await http('get', '/memberships/available-roles', tokens.tenantAdmin)
    expect(tenantAdmin.body.data.roles.map((r) => r.code)).toEqual(['store_admin', 'cashier', 'staff'])
    for (const token of [tokens.storeAdmin, tokens.cashier, tokens.staff, tokens.boundSuper]) {
      const res = await http('get', '/memberships/available-roles', token)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('FORBIDDEN')
    }
  })

  test('the list is the same ceiling the mutation enforces (shared helper)', async () => {
    expect((await http('get', '/memberships/available-roles', tokens.tenantAdmin)).body.data.roles.map((r) => r.code)).toEqual(
      service.grantableRoles('tenant_admin')
    )
    const tenantAdminActor = { userId: tenantAdminA.id, role: 'tenant_admin', tenantId: tenantA.id }
    for (const role of TARGET_ROLES) {
      const err = await service
        .createMembership({ actor: tenantAdminActor, targetUserId: NONEXISTENT_ID, tenantId: tenantA.id, role })
        .catch((e) => e)
      // Allowed roles pass the ceiling (then hit D16 not-found); others are ceiling-denied.
      expect(err.code).toBe(service.grantableRoles('tenant_admin').includes(role) ? 'RESOURCE_NOT_FOUND' : 'ROLE_CEILING')
    }
    const src = require('fs').readFileSync(require('path').join(__dirname, '../api/service/membershipAssignmentService.js'), 'utf8')
    expect(src).toMatch(/!grantableRoles\(act\.role\)\.includes\(requestedRole\)/)
  })
})

// ---------------------------------------------------------------------------
// HTTP membership / assignment API
// ---------------------------------------------------------------------------

describe('membership HTTP API', () => {
  test('global super_admin acts as platform; store-bound super_admin does not', async () => {
    const target = await mkUser('httpcreate')
    const res = await http('post', '/memberships', tokens.platform).send({ userId: target.id, tenantId: tenantA.id, role: 'cashier', reason: 'onboarding' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(Object.keys(res.body.data).sort()).toEqual(['auditId', 'created', 'membership', 'noOp', 'reactivated', 'requestId', 'revokedSessionCount'])
    expectCleanDto(res.body)

    const other = await mkUser('httpbound')
    const denied = await http('post', '/memberships', tokens.boundSuper).send({ userId: other.id, tenantId: tenantA.id, role: 'staff' })
    expect(denied.status).toBe(403)
    expect(denied.body).toMatchObject({ success: false, code: 'FORBIDDEN' })
  })

  test('actor identity never comes from the body', async () => {
    const target = await mkUser('httpforge')
    const res = await http('post', '/memberships', tokens.cashier).send({
      userId: target.id,
      tenantId: tenantA.id,
      role: 'staff',
      actor: { userId: platformLegacy.id, role: 'platform_admin' },
      actorRole: 'platform_admin'
    })
    expect(res.status).toBe(403)
    expect(await db.tenantMembership.count({ where: { userId: target.id } })).toBe(0)
  })

  test('tenant_admin: D16 not-found, ROLE_CEILING, and the error contract shape', async () => {
    const outsider = await mkUser('httpoutsider')
    const notFound = await http('post', '/memberships', tokens.tenantAdmin).send({ userId: outsider.id, role: 'staff' })
    expect(notFound.status).toBe(404)
    expect(notFound.body).toEqual({ success: false, code: 'RESOURCE_NOT_FOUND', field: 'userId', message: 'userId not found' })
    const ceiling = await http('post', '/memberships', tokens.tenantAdmin).send({ userId: outsider.id, role: 'tenant_admin' })
    expect(ceiling.status).toBe(403)
    expect(ceiling.body).toMatchObject({ success: false, code: 'ROLE_CEILING', field: 'role' })
  })

  test('PATCH: status, role, validation, visibility and self-action', async () => {
    const target = await mkUser('httppatch')
    const row = await member(target, tenantA, 'cashier')
    const s = await sessionFor(target)

    const missingReason = await http('patch', `/memberships/${row.id}`, tokens.tenantAdmin).send({ status: 'DEACTIVATED' })
    expect(missingReason.status).toBe(400)
    expect(missingReason.body.code).toBe('INVALID_REASON')
    const bad = await http('patch', `/memberships/${row.id}`, tokens.tenantAdmin).send({ status: 'ACTIVE', role: 'staff' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('INVALID_OPERATION')

    const deactivated = await http('patch', `/memberships/${row.id}`, tokens.tenantAdmin).send({ status: 'DEACTIVATED', reason: 'leave' })
    expect(deactivated.status).toBe(200)
    expect(deactivated.body.data).toMatchObject({ noOp: false, revokedSessionCount: 1 })
    expect((await sessionRow(s.id)).revokedAt).not.toBeNull()
    const reactivated = await http('patch', `/memberships/${row.id}`, tokens.tenantAdmin).send({ status: 'ACTIVE' })
    expect(reactivated.body.data.membership.status).toBe('ACTIVE')
    const roled = await http('patch', `/memberships/${row.id}`, tokens.tenantAdmin).send({ role: 'staff', reason: 'x' })
    expect(roled.body.data.membership.role).toBe('staff')

    const foreignRow = await db.tenantMembership.findOne({ where: { userId: tgtOnlyB.id } })
    const invisible = await http('patch', `/memberships/${foreignRow.id}`, tokens.tenantAdmin).send({ status: 'DEACTIVATED', reason: 'x' })
    const missing = await http('patch', `/memberships/${NONEXISTENT_ID}`, tokens.tenantAdmin).send({ status: 'DEACTIVATED', reason: 'x' })
    expect(invisible.status).toBe(404)
    expect(missing.body).toEqual(invisible.body)
    const asCashier = await http('patch', `/memberships/${foreignRow.id}`, tokens.cashier).send({ status: 'DEACTIVATED', reason: 'x' })
    expect(asCashier.status).toBe(403)

    const ownRow = await db.tenantMembership.findOne({ where: { userId: tenantAdminA.id, tenantId: tenantA.id } })
    const self = await http('patch', `/memberships/${ownRow.id}`, tokens.tenantAdmin).send({ status: 'DEACTIVATED', reason: 'x' })
    expect(self.status).toBe(403)
    expect(self.body).toMatchObject({ code: 'FORBIDDEN', field: 'targetUserId' })
  })

  test('PATCH toTenantId moves a membership (platform only)', async () => {
    const target = await mkUser('httpmove')
    const row = await member(target, tenantA, 'cashier')
    const res = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ toTenantId: tenantB.id, reason: 'transfer' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ created: true, source: { status: 'DEACTIVATED' }, target: { tenantId: tenantB.id, status: 'ACTIVE' } })
    const denied = await http('patch', `/memberships/${row.id}`, tokens.tenantAdmin).send({ toTenantId: tenantB.id, reason: 'x' })
    expect(denied.status).toBe(403)
  })

  test('GET lists and details are scoped to the viewer', async () => {
    const tenantList = await http('get', '/memberships?limit=100', tokens.tenantAdmin)
    expect(tenantList.status).toBe(200)
    expect(tenantList.body.data.every((m) => m.tenantId === tenantA.id)).toBe(true)
    expect(tenantList.body.data.map((m) => m.userId)).toEqual(expect.arrayContaining([tgtInactive.id, tgtRetired.id]))

    const storeList = await http('get', '/memberships?limit=100', tokens.storeAdmin)
    const storeRoles = new Set(storeList.body.data.filter((m) => m.userId !== storeAdminA.id).map((m) => m.role))
    expect([...storeRoles].every((r) => ['cashier', 'staff'].includes(r))).toBe(true)
    expect(storeList.body.data.map((m) => m.userId)).toContain(storeAdminA.id)

    const cashierList = await http('get', '/memberships', tokens.cashier)
    expect(cashierList.body.data.map((m) => m.userId)).toEqual([cashierA.id])

    const foreignRow = await db.tenantMembership.findOne({ where: { userId: tgtOnlyB.id } })
    expect((await http('get', `/memberships/${foreignRow.id}`, tokens.tenantAdmin)).status).toBe(404)
    expect((await http('get', `/memberships/${foreignRow.id}`, tokens.platform)).status).toBe(200)
    expect((await http('get', `/memberships/${foreignRow.id}`, tokens.cashier)).status).toBe(403)
    const ownRow = await db.tenantMembership.findOne({ where: { userId: cashierA.id } })
    expect((await http('get', `/memberships/${ownRow.id}`, tokens.cashier)).body.data).toEqual({
      id: ownRow.id,
      userId: cashierA.id,
      tenantId: tenantA.id,
      role: 'cashier',
      status: 'ACTIVE'
    })
  })

  test('unexpected failures are a generic 500 with no internal detail', async () => {
    const spy = jest.spyOn(service, 'createMembership').mockRejectedValueOnce(new Error('db password=secret'))
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await http('post', '/memberships', tokens.platform).send({ userId: cashierA.id, tenantId: tenantA.id, role: 'cashier' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ success: false, code: 'INTERNAL_ERROR', message: 'Internal Server Error' })
    } finally {
      spy.mockRestore()
      quiet.mockRestore()
    }
  })
})

describe('assignment HTTP API', () => {
  test('store_admin grants its active store to a lower-ranked member; higher-ranked is 404 like a non-member', async () => {
    const target = await mkUser('httpgrant')
    await member(target, tenantA, 'staff')
    const granted = await http('post', '/assignments', tokens.storeAdmin).send({ userId: target.id, storeId: storeA1.id })
    expect(granted.status).toBe(201)
    expect(granted.body.data).toMatchObject({ created: true, assignment: { userId: target.id, storeId: storeA1.id } })

    const higher = await http('post', '/assignments', tokens.storeAdmin).send({ userId: tgtPeerStoreAdmin.id, storeId: storeA1.id })
    const nonMember = await http('post', '/assignments', tokens.storeAdmin).send({ userId: tgtOnlyB.id, storeId: storeA1.id })
    const missing = await http('post', '/assignments', tokens.storeAdmin).send({ userId: NONEXISTENT_ID, storeId: storeA1.id })
    expect(higher.status).toBe(404)
    expect(higher.body).toEqual({ success: false, code: 'RESOURCE_NOT_FOUND', field: 'userId', message: 'userId not found' })
    expect(nonMember.body).toEqual(higher.body)
    expect(missing.body).toEqual(higher.body)

    const revoked = await http('delete', '/assignments', tokens.storeAdmin).send({ userId: target.id, storeId: storeA1.id, reason: 'shift end' })
    expect(revoked.status).toBe(200)
    expect(revoked.body.data).toMatchObject({ revoked: true, noOp: false })
    expectCleanDto(revoked.body)
  })

  test('tenant_admin keeps ROLE_CEILING (403) for a visible higher-ranked member', async () => {
    const res = await http('post', '/assignments', tokens.tenantAdmin).send({ userId: tgtPeerStoreAdmin.id, storeId: storeA2.id })
    expect(res.status).toBe(201)
    const peer = await mkUser('httppeer')
    await member(peer, tenantA, 'tenant_admin')
    const ceiling = await http('post', '/assignments', tokens.tenantAdmin).send({ userId: peer.id, storeId: storeA2.id })
    expect(ceiling.status).toBe(403)
    expect(ceiling.body).toMatchObject({ code: 'ROLE_CEILING', field: 'targetUserId' })
  })

  test('GET /assignments is scoped: store_admin sees only its stores and lower-ranked members', async () => {
    const res = await http('get', '/assignments?limit=100', tokens.storeAdmin)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.every((a) => a.storeId === storeA1.id)).toBe(true)
    expect(res.body.data.map((a) => a.userId)).not.toContain(tgtPeerStoreAdmin.id)
    const cashier = await http('get', '/assignments', tokens.cashier)
    expect(cashier.body.data.map((a) => a.userId)).toEqual([cashierA.id])
    const tenant = await http('get', '/assignments?limit=100', tokens.tenantAdmin)
    expect(tenant.body.data.every((a) => a.tenantId === tenantA.id)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Remediation: store_admin assignment authority = persisted assigned stores
// ---------------------------------------------------------------------------

describe('store_admin assignment authority is its assigned stores, not the selected store', () => {
  test('Case A: an assigned store other than the selected one is allowed (grant, revoke, move)', async () => {
    const target = await mkUser('saA')
    await member(target, tenantA, 'cashier')
    const granted = await http('post', '/assignments', tokens.storeAdminMulti).send({ userId: target.id, storeId: storeA2.id })
    expect(granted.status).toBe(201)
    expect(granted.body.data).toMatchObject({ created: true, assignment: { storeId: storeA2.id } })
    const revoked = await http('delete', '/assignments', tokens.storeAdminMulti).send({ userId: target.id, storeId: storeA2.id, reason: 'x' })
    expect(revoked.status).toBe(200)
    expect(revoked.body.data.revoked).toBe(true)

    await assign(target, storeA1)
    const moved = await service.moveAssignment({
      actor: { userId: storeAdminMulti.id, role: 'store_admin', tenantId: tenantA.id, storeId: storeA1.id },
      targetUserId: target.id,
      fromStoreId: storeA1.id,
      toStoreId: storeA2.id,
      reason: 'x'
    })
    expect(moved).toMatchObject({ moved: true, created: true })
  })

  test('Case B: a store outside the assigned scope is denied exactly like a nonexistent store', async () => {
    const target = await mkUser('saB')
    await member(target, tenantA, 'cashier')
    const outside = await http('post', '/assignments', tokens.storeAdmin).send({ userId: target.id, storeId: storeA2.id })
    const foreign = await http('post', '/assignments', tokens.storeAdmin).send({ userId: target.id, storeId: storeB1.id })
    const missing = await http('post', '/assignments', tokens.storeAdmin).send({ userId: target.id, storeId: NONEXISTENT_ID })
    expect(outside.status).toBe(404)
    expect(outside.body).toEqual({ success: false, code: 'RESOURCE_NOT_FOUND', field: 'storeId', message: 'storeId not found' })
    expect(foreign.body).toEqual(outside.body)
    expect(missing.body).toEqual(outside.body)
    expect(await db.storeAssignment.count({ where: { userId: target.id } })).toBe(0)
  })

  test('Case C: no selected store — an assigned store is allowed', async () => {
    const ctx = await http('get', '/auth/context', tokens.storeAdminNoStore)
    expect(ctx.body.data.context).toMatchObject({ activeTenantId: tenantA.id, activeStoreId: null, activeRole: 'store_admin' })
    const target = await mkUser('saC')
    await member(target, tenantA, 'staff')
    const granted = await http('post', '/assignments', tokens.storeAdminNoStore).send({ userId: target.id, storeId: storeA1.id })
    expect(granted.status).toBe(201)
  })

  test('Case D: the role ceiling still applies, and store_admin never mutates membership roles', async () => {
    for (const token of [tokens.storeAdminNoStore, tokens.storeAdminMulti]) {
      const nonMember = await http('post', '/assignments', token).send({ userId: tgtOnlyB.id, storeId: storeA1.id })
      for (const higher of [tenantAdminA, tgtPeerStoreAdmin]) {
        const res = await http('post', '/assignments', token).send({ userId: higher.id, storeId: storeA1.id })
        expect(res.status).toBe(404)
        expect(res.body).toEqual(nonMember.body)
      }
    }
    const row = await db.tenantMembership.findOne({ where: { userId: tgtCashier.id, tenantId: tenantA.id } })
    const roleChange = await http('patch', `/memberships/${row.id}`, tokens.storeAdminMulti).send({ role: 'staff', reason: 'x' })
    expect(roleChange.status).toBe(403)
    expect(roleChange.body).toMatchObject({ code: 'FORBIDDEN', field: 'actor' })
    expect((await db.tenantMembership.findByPk(row.id)).role).toBe('cashier')
  })

  test('higher-ranked vs nonexistent assignment targets run the same queries', async () => {
    let a
    let b
    const sqlA = await captureSql(async () => {
      a = await http('post', '/assignments', tokens.storeAdminMulti).send({ userId: tgtPeerStoreAdmin.id, storeId: storeA2.id })
    })
    const sqlB = await captureSql(async () => {
      b = await http('post', '/assignments', tokens.storeAdminMulti).send({ userId: NONEXISTENT_ID, storeId: storeA2.id })
    })
    expect(a.status).toBe(404)
    expect(b.body).toEqual(a.body)
    expect(sqlB).toEqual(sqlA)
  })
})

// ---------------------------------------------------------------------------
// PATCH /memberships/:id operation contract (INVALID_OPERATION)
// ---------------------------------------------------------------------------

describe('PATCH /memberships operation contract', () => {
  test('missing, multiple or unknown operations are INVALID_OPERATION; other validation codes are preserved', async () => {
    const target = await mkUser('opbad')
    const row = await member(target, tenantA, 'cashier')
    const invalid = { success: false, code: 'INVALID_OPERATION', field: 'status', message: 'exactly one of status, role or toTenantId is required' }
    for (const body of [{}, { role: 'staff', status: 'DEACTIVATED' }, { toTenantId: tenantB.id, status: 'DEACTIVATED' }, { status: 'FOO' }]) {
      const res = await http('patch', `/memberships/${row.id}`, tokens.platform).send(body)
      expect(res.status).toBe(400)
      expect(res.body).toEqual(invalid)
    }
    const badRole = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ role: 'owner', reason: 'x' })
    expect(badRole.body).toMatchObject({ code: 'INVALID_ROLE', field: 'role' })
    const noReason = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ status: 'DEACTIVATED' })
    expect(noReason.body).toMatchObject({ code: 'INVALID_REASON', field: 'reason' })
    const longRequestId = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ status: 'DEACTIVATED', reason: 'x', requestId: 'r'.repeat(65) })
    expect(longRequestId.body).toMatchObject({ code: 'INVALID_REQUEST_ID', field: 'requestId' })
    expect((await db.tenantMembership.findByPk(row.id)).status).toBe('ACTIVE')
  })

  test('role, status and move keep their semantics; move + role sets the target role', async () => {
    const target = await mkUser('opok')
    const row = await member(target, tenantA, 'cashier')
    const roled = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ role: 'staff', reason: 'x' })
    expect(roled.body.data).toMatchObject({ noOp: false, downgrade: true, membership: { role: 'staff' } })
    const deactivated = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ status: 'DEACTIVATED', reason: 'x' })
    expect(deactivated.body.data.membership.status).toBe('DEACTIVATED')
    const retiredTarget = await mkUser('opretire')
    const retireRow = await member(retiredTarget, tenantA, 'staff')
    const retired = await http('patch', `/memberships/${retireRow.id}`, tokens.platform).send({ status: 'RETIRED', reason: 'x' })
    expect(retired.body.data.membership.status).toBe('RETIRED')
    const reactivated = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ status: 'ACTIVE' })
    expect(reactivated.body.data.membership.status).toBe('ACTIVE')

    const withRole = await http('patch', `/memberships/${row.id}`, tokens.platform).send({ toTenantId: tenantB.id, role: 'store_admin', reason: 'x' })
    expect(withRole.status).toBe(200)
    expect(withRole.body.data).toMatchObject({ created: true, target: { tenantId: tenantB.id, role: 'store_admin', status: 'ACTIVE' } })

    const plainTarget = await mkUser('opmove')
    const plainRow = await member(plainTarget, tenantA, 'cashier')
    const plain = await http('patch', `/memberships/${plainRow.id}`, tokens.platform).send({ toTenantId: tenantB.id, reason: 'x' })
    expect(plain.body.data.target).toMatchObject({ tenantId: tenantB.id, role: 'cashier' })
  })
})

// ---------------------------------------------------------------------------
// Pagination contract
// ---------------------------------------------------------------------------

describe('pagination contract', () => {
  test('defaults, metadata, disjoint pages and the 100 cap', async () => {
    const first = await http('get', '/memberships', tokens.tenantAdmin)
    const { total } = first.body.pagination
    expect(total).toBeGreaterThan(4)
    expect(first.body.pagination).toEqual({ page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) })
    expect(Array.isArray(first.body.data)).toBe(true)

    const p1 = await http('get', '/memberships?limit=2&page=1', tokens.tenantAdmin)
    const p2 = await http('get', '/memberships?limit=2&page=2', tokens.tenantAdmin)
    expect(p2.body.pagination).toEqual({ page: 2, limit: 2, total, totalPages: Math.ceil(total / 2) })
    expect(p1.body.data).toHaveLength(2)
    expect(p2.body.data).toHaveLength(2)
    expect(Math.max(...p1.body.data.map((m) => m.id))).toBeLessThan(Math.min(...p2.body.data.map((m) => m.id)))

    expect((await http('get', '/memberships?limit=1000', tokens.tenantAdmin)).body.pagination.limit).toBe(100)
    expect((await http('get', '/memberships?page=0&limit=abc', tokens.tenantAdmin)).body.pagination).toMatchObject({ page: 1, limit: 20 })
    const beyond = await http('get', `/memberships?page=${total + 5}`, tokens.tenantAdmin)
    expect(beyond.body).toMatchObject({ data: [], pagination: { total } })

    const assignments = await http('get', '/assignments?limit=3', tokens.tenantAdmin)
    expect(assignments.body.pagination).toEqual({
      page: 1,
      limit: 3,
      total: assignments.body.pagination.total,
      totalPages: Math.ceil(assignments.body.pagination.total / 3)
    })
  })

  test('invalid filters match nothing (never widen) and rows expose only their DTO fields', async () => {
    for (const path of ['/memberships?userId=abc', '/memberships?tenantId=-1', '/assignments?storeId=abc', '/assignments?userId=1.5']) {
      const res = await http('get', path, tokens.tenantAdmin)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ data: [], pagination: { total: 0, totalPages: 0 } })
    }
    const memberships = await http('get', '/memberships?limit=100', tokens.tenantAdmin)
    for (const row of memberships.body.data) expect(Object.keys(row).sort()).toEqual(['id', 'role', 'status', 'tenantId', 'userId'])
    const assignments = await http('get', '/assignments?limit=100', tokens.tenantAdmin)
    for (const row of assignments.body.data) expect(Object.keys(row).sort()).toEqual(['id', 'storeId', 'tenantId', 'userId'])
    expectCleanDto(memberships.body)
    expectCleanDto(assignments.body)
  })
})

// ---------------------------------------------------------------------------
// Freshness precision, DB clock, probe placement, schema agreement
// ---------------------------------------------------------------------------

describe('reactivation freshness precision and DB clock', () => {
  test('before / after / same millisecond / NULL', async () => {
    const user = await mkUser('precision')
    const row = await member(user, tenantA, 'cashier')
    const effectiveFor = async (authenticatedAt) =>
      (await resolveAuthorizationContext(db, { userId: user.id, authenticatedAt })).effectiveTenantIds

    // NULL reactivatedAt: no freshness restriction, even for an ancient session.
    expect(await effectiveFor(new Date(0))).toEqual([tenantA.id])

    // Reactivated at .000500 (µs). JS sees .000 for both instants below.
    await db.sequelize.query('UPDATE tenant_membership SET "reactivatedAt" = $1 WHERE id = $2', {
      bind: ['2026-06-01T00:00:00.000500Z', row.id]
    })
    const ms = new Date('2026-06-01T00:00:00.000Z').getTime()
    expect(await effectiveFor(new Date(ms - 1))).toEqual([]) // strictly before
    expect(await effectiveFor(new Date(ms))).toEqual([]) // same millisecond → stale (fail closed)
    expect(await effectiveFor(new Date(ms + 1))).toEqual([tenantA.id]) // after
    // Without authenticatedAt the resolver keeps its existing semantics.
    expect((await resolveAuthorizationContext(db, { userId: user.id })).effectiveTenantIds).toEqual([tenantA.id])
  })

  test('the returned reactivatedAt is the persisted DB-clock value', async () => {
    const user = await mkUser('dbclock2')
    await member(user, tenantA, 'cashier', 'DEACTIVATED')
    const [[{ before }]] = await db.sequelize.query('SELECT NOW() AS before')
    const res = await service.reactivateMembership({ actor: platformActor(), targetUserId: user.id, tenantId: tenantA.id })
    const [[{ after }]] = await db.sequelize.query('SELECT NOW() AS after')
    const persisted = await db.tenantMembership.findOne({ where: { userId: user.id, tenantId: tenantA.id } })
    const returned = new Date(res.membership.reactivatedAt).getTime()
    expect(returned).toBe(persisted.reactivatedAt.getTime())
    expect(returned).toBeGreaterThanOrEqual(new Date(before).getTime())
    expect(returned).toBeLessThanOrEqual(new Date(after).getTime())
  })

  test('switch probes run after the locks, inside the same transaction', async () => {
    const user = await mkUser('probeorder')
    await member(user, tenantA, 'cashier')
    await assign(user, storeA1)
    const s = await sessionFor(user)
    const memberships = jest.spyOn(db.tenantMembership, 'findAll')
    const sessions = jest.spyOn(db.authorizationContextSession, 'findOne')
    const calls = (spy) => spy.mock.calls.map(([opts], i) => ({ opts: opts || {}, order: spy.mock.invocationCallOrder[i] }))
    try {
      await mw.switchSessionTenant(db, s.sessionId, user.id, tenantA.id)
      await mw.switchSessionStore(db, s.sessionId, user.id, storeA1.id)
      const sessionLocks = calls(sessions).filter(({ opts }) => opts.lock)
      const membershipLocks = calls(memberships).filter(({ opts }) => opts.lock)
      const probes = calls(memberships).filter(({ opts }) => !opts.lock && opts.include)
      expect(sessionLocks).toHaveLength(2)
      expect(probes).toHaveLength(2)
      for (let i = 0; i < 2; i += 1) {
        expect(probes[i].order).toBeGreaterThan(sessionLocks[i].order)
        expect(probes[i].opts.transaction).toBeTruthy()
        expect(probes[i].opts.transaction).toBe(membershipLocks[i].opts.transaction)
        expect(probes[i].opts.transaction).toBe(sessionLocks[i].opts.transaction)
      }
    } finally {
      memberships.mockRestore()
      sessions.mockRestore()
    }
  })

  test('test DB, migration and model agree on tenant_membership.reactivatedAt', async () => {
    const [rows] = await db.sequelize.query(
      "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_membership' AND column_name = 'reactivatedAt'"
    )
    expect(rows).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }])
    expect(db.tenantMembership.rawAttributes.reactivatedAt).toMatchObject({ allowNull: true })
    const migration = require('fs').readFileSync(
      require('path').join(__dirname, '../db/migrations/20261011000001-add-reactivated-at-to-tenant-membership.js'),
      'utf8'
    )
    expect(migration).toMatch(/table: 'tenant_membership'/)
    expect(migration).toMatch(/name: 'reactivatedAt',\s+def: \{ type: Sequelize\.DATE, allowNull: true/)
  })
})

describe('D8 store_admin visibility is independent of the selected store', () => {
  test('same view with or without a selected store; assignments span every assigned store', async () => {
    const withStore = await http('get', `/effective-scope?userId=${tgtCashier.id}`, tokens.storeAdmin)
    const noStore = await http('get', `/effective-scope?userId=${tgtCashier.id}`, tokens.storeAdminNoStore)
    expect(noStore.status).toBe(200)
    expect(noStore.body).toEqual(withStore.body)
    const multi = await http('get', `/effective-scope?userId=${tgtCashier.id}`, tokens.storeAdminMulti)
    expect(multi.body.data.assignments).toEqual([
      { tenantId: tenantA.id, storeId: storeA1.id, effective: true },
      { tenantId: tenantA.id, storeId: storeA2.id, effective: true }
    ])
    expectCleanDto(multi.body)
  })
})

// ---------------------------------------------------------------------------
// TG-5 / OD-1(a): platform mutation boundary with a tenant selected
// ---------------------------------------------------------------------------

describe('OD-1(a) platform mutation boundary with tenant selected (TG-5)', () => {
  test('platform with tenant A selected reaches tenant B for all mutations', async () => {
    // Precondition: platformMember is a platform_admin whose session selected tenant A.
    const ctx = await http('get', '/auth/context', tokens.platformMember)
    expect(ctx.status).toBe(200)
    expect(ctx.body.data.context).toMatchObject({ activeTenantId: tenantA.id, activeRole: 'platform_admin' })

    // 1. POST /memberships reaches tenant B.
    const uCreate = await mkUser('tg5create')
    const created = await http('post', '/memberships', tokens.platformMember).send({
      userId: uCreate.id,
      tenantId: tenantB.id,
      role: 'cashier',
      reason: 'onboarding'
    })
    expect(created.status).toBe(201)
    expect(created.body.data.membership).toMatchObject({ userId: uCreate.id, tenantId: tenantB.id })
    expectCleanDto(created.body)

    // 2. POST /assignments reaches tenant B.
    const uAssign = await mkUser('tg5assign')
    await member(uAssign, tenantB, 'cashier')
    const granted = await http('post', '/assignments', tokens.platformMember).send({ userId: uAssign.id, storeId: storeB1.id })
    expect(granted.status).toBe(201)
    expect(granted.body.data).toMatchObject({ created: true, assignment: { userId: uAssign.id, storeId: storeB1.id } })

    // 3. DELETE /assignments can revoke the tenant B assignment.
    const revoked = await http('delete', '/assignments', tokens.platformMember).send({
      userId: uAssign.id,
      storeId: storeB1.id,
      reason: 'shift end'
    })
    expect(revoked.status).toBe(200)
    expect(revoked.body.data).toMatchObject({ revoked: true })
    expectCleanDto(revoked.body)

    // 4. PATCH /memberships/:id status mutation reaches tenant B.
    const uPatch = await mkUser('tg5patch')
    const patchRow = await member(uPatch, tenantB, 'cashier')
    const patched = await http('patch', `/memberships/${patchRow.id}`, tokens.platformMember).send({
      status: 'DEACTIVATED',
      reason: 'leave'
    })
    expect(patched.status).toBe(200)
    expect(patched.body.data.membership).toMatchObject({ userId: uPatch.id, tenantId: tenantB.id, status: 'DEACTIVATED' })

    // 5. PATCH /memberships/:id with { toTenantId } performs the platform-only
    // cross-tenant move where the existing contract permits it (B -> A here).
    const uMove = await mkUser('tg5move')
    const moveRow = await member(uMove, tenantB, 'cashier')
    const moved = await http('patch', `/memberships/${moveRow.id}`, tokens.platformMember).send({
      toTenantId: tenantA.id,
      reason: 'transfer'
    })
    expect(moved.status).toBe(200)
    expect(moved.body.data).toMatchObject({
      created: true,
      source: { tenantId: tenantB.id, status: 'DEACTIVATED' },
      target: { tenantId: tenantA.id, status: 'ACTIVE' }
    })

    // Security property: unknown membership ids still yield the generic 404.
    const unknown = await http('patch', `/memberships/${NONEXISTENT_ID}`, tokens.platformMember).send({
      status: 'DEACTIVATED',
      reason: 'x'
    })
    expect(unknown.status).toBe(404)
    expect(unknown.body).toEqual({ success: false, code: 'RESOURCE_NOT_FOUND', field: 'id', message: 'id not found' })
  })

  test('read boundary: effective-scope and GET stay tenant-constrained', async () => {
    // Tenant-B-only target stays invisible to the A-selected platform viewer.
    const hidden = await http('get', `/effective-scope?userId=${tgtOnlyB.id}`, tokens.platformMember)
    expect(hidden.status).toBe(404)

    // Multi-tenant target is confined to the selected tenant (no global widening).
    const multi = await http('get', `/effective-scope?userId=${tgtMulti.id}`, tokens.platformMember)
    expect(multi.status).toBe(200)
    expect(multi.body.data.memberships).toEqual([{ tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' }])
    expect(multi.body.data.assignments).toEqual([{ tenantId: tenantA.id, storeId: storeA1.id, effective: true }])
    expectCleanDto(multi.body)

    // Lists stay scoped to the selected tenant.
    const list = await http('get', '/memberships?limit=100', tokens.platformMember)
    expect(list.status).toBe(200)
    expect(list.body.data.length).toBeGreaterThan(0)
    expect(list.body.data.every((m) => m.tenantId === tenantA.id)).toBe(true)

    // Same row: GET stays 404 (D8 read) while PATCH reaches it (OD-1(a) mutation).
    const uRead = await mkUser('tg5read')
    const readRow = await member(uRead, tenantB, 'cashier')
    expect((await http('get', `/memberships/${readRow.id}`, tokens.platformMember)).status).toBe(404)
    const patched = await http('patch', `/memberships/${readRow.id}`, tokens.platformMember).send({
      status: 'DEACTIVATED',
      reason: 'x'
    })
    expect(patched.status).toBe(200)
    expect(patched.body.data.membership).toMatchObject({ tenantId: tenantB.id, status: 'DEACTIVATED' })
    // The read view did not widen as a side effect.
    expect((await http('get', `/memberships/${readRow.id}`, tokens.platformMember)).status).toBe(404)
  })

  test('non-platform regression: tenant_admin cross-tenant PATCH stays 404', async () => {
    const uCross = await mkUser('tg5cross')
    const crossRow = await member(uCross, tenantB, 'cashier')

    const invisible = await http('patch', `/memberships/${crossRow.id}`, tokens.tenantAdmin).send({
      status: 'DEACTIVATED',
      reason: 'x'
    })
    const missing = await http('patch', `/memberships/${NONEXISTENT_ID}`, tokens.tenantAdmin).send({
      status: 'DEACTIVATED',
      reason: 'x'
    })
    expect(invisible.status).toBe(404)
    expect(missing.body).toEqual(invisible.body)
    expect(invisible.body).toEqual({ success: false, code: 'RESOURCE_NOT_FOUND', field: 'id', message: 'id not found' })

    const moveDenied = await http('patch', `/memberships/${crossRow.id}`, tokens.tenantAdmin).send({
      toTenantId: tenantA.id,
      reason: 'x'
    })
    expect(moveDenied.status).toBe(404)
    expect(moveDenied.body).toEqual(invisible.body)

    // The row was not mutated through the denied path.
    expect((await db.tenantMembership.findByPk(crossRow.id)).status).toBe('ACTIVE')
  })
})
