'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// AUD-3 canonical authorization tests (REPLACE disposition of the legacy WIP).
// Authority comes ONLY from the server-side session context + persisted
// membership/assignment/ownership — never from JWT claims, cookies, or
// query/body values. Isolated cashier_app_test database; AUD_ fixtures
// removed in afterAll. Never touches real data.
const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const { recordAudit } = require('../utils/auditLog')
const mw = require('../utils/authorizationContextMiddleware')

const JWT_SECRET = process.env.JWT_SECRET_KEY
const P = 'AUD_AUTH_'

let tenantA = null
let tenantB = null
let storeA = null
let storeB = null
let adminA = null
let adminB = null
let kasirA = null
let staffUser = null
let superAdmin = null
let adminAToken = null
let adminBToken = null
let kasirAToken = null
let staffToken = null
let superAdminToken = null
let rowAId = null
let rowBId = null

const sessionToken = async (user, tenantId = null, storeId = null, extraClaims = {}) => {
  const s = await mw.createContextSession(db, { userId: user.id })
  if (tenantId != null) await mw.switchSessionTenant(db, s.sessionId, user.id, tenantId)
  if (storeId != null) await mw.switchSessionStore(db, s.sessionId, user.id, storeId)
  return jwt.sign({ id: user.id, sessionId: s.sessionId, ...extraClaims }, JWT_SECRET)
}

beforeAll(async () => {
  tenantA = await db.tenant.create({ code: `${P}A`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B`, name: `${P}Tenant B` })
  storeA = await db.location.create({ name: `${P}STORE_A`, status: 'active', tenantId: tenantA.id })
  storeB = await db.location.create({ name: `${P}STORE_B`, status: 'active', tenantId: tenantB.id })

  const mkUser = (key, roleType, store) =>
    db.user.create({
      userName: `${P}${key}`,
      email: `${P}${key}@test.com`,
      roleType,
      userType: roleType === 'kasir' ? 'kasir' : 'admin',
      store: store ? store.id : null,
      status: 'active',
      password: 'Test12345'
    })
  adminA = await mkUser('admin_a', 'admin', storeA)
  adminB = await mkUser('admin_b', 'admin', storeB)
  kasirA = await mkUser('kasir_a', 'kasir', storeA)
  staffUser = await mkUser('staff_a', 'user', storeA)
  superAdmin = await db.user.create({
    userName: `${P}superadmin`,
    email: `${P}superadmin@test.com`,
    roleType: 'super_admin',
    userType: 'admin',
    store: null,
    status: 'active',
    password: 'Test12345'
  })

  await db.tenantMembership.create({ userId: adminA.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: adminB.id, tenantId: tenantB.id, role: 'store_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: kasirA.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: staffUser.id, tenantId: tenantA.id, role: 'staff', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: adminA.id, tenantId: tenantA.id, storeId: storeA.id })
  await db.storeAssignment.create({ userId: adminB.id, tenantId: tenantB.id, storeId: storeB.id })
  await db.storeAssignment.create({ userId: kasirA.id, tenantId: tenantA.id, storeId: storeA.id })
  await db.storeAssignment.create({ userId: staffUser.id, tenantId: tenantA.id, storeId: storeA.id })

  adminAToken = await sessionToken(adminA, tenantA.id, storeA.id)
  adminBToken = await sessionToken(adminB, tenantB.id, storeB.id)
  kasirAToken = await sessionToken(kasirA, tenantA.id, storeA.id)
  staffToken = await sessionToken(staffUser, tenantA.id, storeA.id)
  superAdminToken = await sessionToken(superAdmin)

  const rowA = await recordAudit({
    actor: { type: 'USER', id: adminA.id },
    action: 'CREATE',
    entity: `${P}ORDER`,
    entityId: 101,
    storeId: storeA.id,
    tenantId: tenantA.id,
    description: `${P}row-a`
  })
  const rowB = await recordAudit({
    actor: { type: 'USER', id: adminB.id },
    action: 'CREATE',
    entity: `${P}ORDER`,
    entityId: 202,
    storeId: storeB.id,
    tenantId: tenantB.id,
    description: `${P}row-b`
  })
  await recordAudit({
    actor: { type: 'SYSTEM' },
    action: 'EXPORT',
    entity: `${P}SYSTEM`,
    storeId: null,
    tenantId: null,
    description: `${P}row-null-scope`
  })
  rowAId = rowA.id
  rowBId = rowB.id
}, 60000)

afterAll(async () => {
  await db.auditLog.destroy({
    where: { description: { [db.Sequelize.Op.like]: `${P}%` } },
    force: true,
    __auditMaintenance: true
  }).catch(() => {})
  // DENIED audit-of-audit rows recorded by the canonical gate (actor-scoped:
  // parallel workers share the test database, so never match other files).
  await db.auditLog.destroy({
    where: {
      entity: 'auditLog',
      result: 'DENIED',
      userId: [adminA?.id, adminB?.id, kasirA?.id, staffUser?.id, superAdmin?.id].filter(Boolean)
    },
    force: true,
    __auditMaintenance: true
  }).catch(() => {})
  const userIds = [adminA?.id, adminB?.id, kasirA?.id, staffUser?.id, superAdmin?.id].filter(Boolean)
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  }
  await db.storeAssignment.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  await db.user.destroy({ where: { id: userIds }, force: true }).catch(() => {})
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.tenant.destroy({ where: { id: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 60000)

describe('AUD-3 authentication & role gate', () => {
  test('unauthenticated list request is 401', async () => {
    const res = await request(app).get('/audit-log')
    expect(res.status).toBe(401)
  })

  test('unauthenticated detail request is 401', async () => {
    const res = await request(app).get(`/audit-log/${P}ORDER/101`)
    expect(res.status).toBe(401)
  })

  test('cashier list + detail requests are 403 by default', async () => {
    const list = await request(app).get('/audit-log').set('Authorization', `Bearer ${kasirAToken}`)
    expect(list.status).toBe(403)
    const detail = await request(app)
      .get(`/audit-log/${P}ORDER/101`)
      .set('Authorization', `Bearer ${kasirAToken}`)
    expect(detail.status).toBe(403)
  })

  test('staff (user role) list request is 403 by default', async () => {
    const res = await request(app).get('/audit-log').set('Authorization', `Bearer ${staffToken}`)
    expect(res.status).toBe(403)
  })
})

describe('AUD-3 store isolation (canonical session scope)', () => {
  test('store A admin sees only store A rows with a scoped count', async () => {
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminAToken}`)
      .query({ entity: `${P}ORDER` })
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    for (const row of res.body.data) {
      expect(row.store).toBe(storeA.id)
    }
    expect(res.body.pagination.total).toBe(res.body.data.length)
    expect(res.body.data.some((row) => row.id === rowBId)).toBe(false)
    expect(res.body.data.some((row) => row.id === rowAId)).toBe(true)
  })

  test('store B admin cannot see store A rows', async () => {
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminBToken}`)
      .query({ entity: `${P}ORDER` })
    expect(res.status).toBe(200)
    expect(res.body.data.some((row) => row.id === rowAId)).toBe(false)
    expect(res.body.data.some((row) => row.id === rowBId)).toBe(true)
  })

  test('store A admin requesting ?store=B is rejected, ?store=A stays scoped', async () => {
    const foreign = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminAToken}`)
      .query({ store: storeB.id })
    expect(foreign.status).toBe(403)

    const own = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminAToken}`)
      .query({ store: storeA.id, entity: `${P}ORDER` })
    expect(own.status).toBe(200)
    for (const row of own.body.data) {
      expect(row.store).toBe(storeA.id)
    }
  })

  test('client tenantId cannot broaden scope beyond the authorized store', async () => {
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminAToken}`)
      .query({ tenantId: 999999, entity: `${P}ORDER` })
    expect(res.status).toBe(200)
    for (const row of res.body.data) {
      expect(row.store).toBe(storeA.id)
    }
    expect(res.body.data.some((row) => row.id === rowBId)).toBe(false)
  })

  test('direct entity access to another store row returns no payload', async () => {
    const foreign = await request(app)
      .get(`/audit-log/${P}ORDER/202`)
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(foreign.status).toBe(200)
    expect(foreign.body.data).toHaveLength(0)
    expect(foreign.body.pagination.total).toBe(0)

    const own = await request(app)
      .get(`/audit-log/${P}ORDER/101`)
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(own.status).toBe(200)
    expect(own.body.data.some((row) => row.id === rowAId)).toBe(true)
  })

  test('NULL-scope (platform) rows are invisible to store admins', async () => {
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminAToken}`)
      .query({ entity: `${P}SYSTEM` })
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.pagination.total).toBe(0)
  })
})

describe('AUD-3 canonical authority (not JWT claims)', () => {
  test('forged JWT role/store claims cannot widen scope', async () => {
    const forged = await sessionToken(adminA, tenantA.id, storeA.id, {
      roleType: 'super_admin',
      store: storeB.id
    })
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${forged}`)
      .query({ entity: `${P}ORDER` })
    expect(res.status).toBe(200)
    expect(res.body.data.some((row) => row.id === rowBId)).toBe(false)
    expect(res.body.data.some((row) => row.id === rowAId)).toBe(true)
  })

  test('forged JWT claims cannot obtain platform rows', async () => {
    const forged = await sessionToken(adminA, tenantA.id, storeA.id, {
      roleType: 'super_admin',
      store: storeB.id
    })
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${forged}`)
      .query({ entity: `${P}SYSTEM` })
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  test('forged cookie store cannot widen scope', async () => {
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('Cookie', `store=${storeB.id}`)
      .query({ entity: `${P}ORDER` })
    expect([200, 403]).toContain(res.status)
    if (res.status === 200) {
      expect(res.body.data.some((row) => row.id === rowBId)).toBe(false)
    }
  })
})

describe('AUD-3 platform capability', () => {
  test('platform actor sees cross-store and NULL-scope rows', async () => {
    const scoped = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .query({ entity: `${P}ORDER` })
    expect(scoped.status).toBe(200)
    expect(scoped.body.data.some((row) => row.id === rowAId)).toBe(true)
    expect(scoped.body.data.some((row) => row.id === rowBId)).toBe(true)

    const platform = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .query({ entity: `${P}SYSTEM` })
    expect(platform.status).toBe(200)
    expect(platform.body.data.length).toBeGreaterThan(0)
  })

  test('platform scope is not altered by cookies', async () => {
    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('Cookie', `store=${storeA.id}`)
      .query({ entity: `${P}ORDER` })
    expect(res.status).toBe(200)
    expect(res.body.data.some((row) => row.id === rowAId)).toBe(true)
    expect(res.body.data.some((row) => row.id === rowBId)).toBe(true)
  })
})
