'use strict'

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// AUD-3 canonical context matrix: tenant_admin, lifecycle, revocation,
// historical rows, pagination parity, store-bound super_admin, bypasses.
// Isolated cashier_app_test database; AUD_CTX_ fixtures removed in afterAll.
const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const { recordAudit } = require('../utils/auditLog')
const mw = require('../utils/authorizationContextMiddleware')

const JWT_SECRET = process.env.JWT_SECRET_KEY
const P = 'AUD_CTX_'

let tenantA = null
let tenantB = null
let storeA1 = null
let storeA2 = null
let storeB1 = null
let storeInactive = null
let storeRetired = null
let storeQuarantined = null
let tenantAdminA = null
let storeAdminA = null
let cashierA = null
let staffA = null
let platformUser = null
let boundSuper = null
let tenantAdminToken = null
let storeAdminToken = null
let cashierToken = null
let staffToken = null
let platformToken = null
let boundSuperToken = null
let rowA1Id = null
let rowA2Id = null
let rowB1Id = null
let rowInactiveId = null
let rowRetiredId = null
let rowQuarantinedId = null
let rowNullScopeId = null
let rowHistTenantNullId = null

const sessionToken = async (user, tenantId = null, storeId = null, extraClaims = {}) => {
  const s = await mw.createContextSession(db, { userId: user.id })
  if (tenantId != null) await mw.switchSessionTenant(db, s.sessionId, user.id, tenantId)
  if (storeId != null) await mw.switchSessionStore(db, s.sessionId, user.id, storeId)
  return {
    token: jwt.sign({ id: user.id, sessionId: s.sessionId, ...extraClaims }, JWT_SECRET),
    sessionId: s.sessionId
  }
}

const mkUser = (key, roleType, store) =>
  db.user.create({
    userName: `${P}${key}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    email: `${P}${key}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@test.com`,
    roleType,
    store: store ? store.id : null,
    status: 'active',
    password: 'Test12345'
  })

beforeAll(async () => {
  tenantA = await db.tenant.create({ code: `${P}A`, name: `${P}Tenant A` })
  tenantB = await db.tenant.create({ code: `${P}B`, name: `${P}Tenant B` })
  storeA1 = await db.location.create({ name: `${P}STORE_A1`, status: 'active', tenantId: tenantA.id })
  storeA2 = await db.location.create({ name: `${P}STORE_A2`, status: 'active', tenantId: tenantA.id })
  storeB1 = await db.location.create({ name: `${P}STORE_B1`, status: 'active', tenantId: tenantB.id })
  storeInactive = await db.location.create({ name: `${P}STORE_IN`, status: 'inactive', tenantId: tenantA.id })
  storeRetired = await db.location.create({ name: `${P}STORE_RE`, status: 'retired', tenantId: tenantA.id })
  storeQuarantined = await db.location.create({ name: `${P}STORE_QU`, status: 'quarantined', tenantId: tenantA.id })

  tenantAdminA = await mkUser('tadmin', 'admin', storeA1)
  storeAdminA = await mkUser('sadmin', 'admin', storeA1)
  cashierA = await mkUser('cashier', 'kasir', storeA1)
  staffA = await mkUser('staff', 'user', storeA1)
  platformUser = await mkUser('platform', 'admin', null)
  boundSuper = await mkUser('boundsuper', 'super_admin', storeA1)

  await db.tenantMembership.create({ userId: tenantAdminA.id, tenantId: tenantA.id, role: 'tenant_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: storeAdminA.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: cashierA.id, tenantId: tenantA.id, role: 'cashier', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: staffA.id, tenantId: tenantA.id, role: 'staff', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: platformUser.id, tenantId: tenantA.id, role: 'platform_admin', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: platformUser.id, tenantId: tenantB.id, role: 'staff', status: 'ACTIVE' })
  await db.tenantMembership.create({ userId: boundSuper.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
  await db.storeAssignment.create({ userId: storeAdminA.id, tenantId: tenantA.id, storeId: storeA1.id })
  await db.storeAssignment.create({ userId: cashierA.id, tenantId: tenantA.id, storeId: storeA1.id })
  await db.storeAssignment.create({ userId: staffA.id, tenantId: tenantA.id, storeId: storeA1.id })
  await db.storeAssignment.create({ userId: boundSuper.id, tenantId: tenantA.id, storeId: storeA1.id })

  tenantAdminToken = (await sessionToken(tenantAdminA, tenantA.id)).token
  storeAdminToken = (await sessionToken(storeAdminA, tenantA.id, storeA1.id)).token
  cashierToken = (await sessionToken(cashierA, tenantA.id, storeA1.id)).token
  staffToken = (await sessionToken(staffA, tenantA.id, storeA1.id)).token
  platformToken = (await sessionToken(platformUser)).token
  boundSuperToken = (await sessionToken(boundSuper, tenantA.id, storeA1.id)).token

  const mkRow = (suffix, storeId, tenantId) =>
    recordAudit({
      actor: { type: 'USER', id: tenantAdminA.id },
      action: 'CREATE',
      entity: `${P}ORDER`,
      entityId: suffix,
      storeId,
      tenantId,
      description: `${P}row-${suffix}`
    })
  rowA1Id = (await mkRow(101, storeA1.id, tenantA.id)).id
  rowA2Id = (await mkRow(102, storeA2.id, tenantA.id)).id
  rowB1Id = (await mkRow(201, storeB1.id, tenantB.id)).id
  rowInactiveId = (await mkRow(301, storeInactive.id, tenantA.id)).id
  rowRetiredId = (await mkRow(302, storeRetired.id, tenantA.id)).id
  rowQuarantinedId = (await mkRow(303, storeQuarantined.id, tenantA.id)).id
  rowNullScopeId = (
    await recordAudit({
      actor: { type: 'SYSTEM' },
      action: 'EXPORT',
      entity: `${P}SYSTEM`,
      storeId: null,
      tenantId: null,
      description: `${P}row-null-scope`
    })
  ).id
  // Historical row: store set, tenant never attributed.
  rowHistTenantNullId = (await mkRow(401, storeA1.id, null)).id
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
      userId: [tenantAdminA?.id, storeAdminA?.id, cashierA?.id, staffA?.id, platformUser?.id, boundSuper?.id].filter(Boolean)
    },
    force: true,
    __auditMaintenance: true
  }).catch(() => {})
  const userIds = [tenantAdminA?.id, storeAdminA?.id, cashierA?.id, staffA?.id, platformUser?.id, boundSuper?.id].filter(Boolean)
  if (db.authorizationContextSession) {
    await db.authorizationContextSession.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  }
  await db.storeAssignment.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  await db.tenantMembership.destroy({ where: { userId: userIds }, force: true }).catch(() => {})
  await db.user.destroy({ where: { id: userIds }, force: true }).catch(() => {})
  await db.location.destroy({
    where: { id: [storeA1?.id, storeA2?.id, storeB1?.id, storeInactive?.id, storeRetired?.id, storeQuarantined?.id].filter(Boolean) },
    force: true
  }).catch(() => {})
  await db.tenant.destroy({ where: { id: [tenantA?.id, tenantB?.id].filter(Boolean) }, force: true }).catch(() => {})
  await db.sequelize.close().catch(() => {})
}, 60000)

const get = (token) => request(app).get('/audit-log').set('Authorization', `Bearer ${token}`)
const detail = (token, entityId) =>
  request(app).get(`/audit-log/${P}ORDER/${entityId}`).set('Authorization', `Bearer ${token}`)

describe('AUD-3 authentication', () => {
  test('unauthenticated detail is 401', async () => {
    expect((await request(app).get(`/audit-log/${P}ORDER/101`)).status).toBe(401)
  })

  test('ineligible account is 401', async () => {
    const u = await mkUser('inactive', 'admin', storeA1)
    await db.tenantMembership.create({ userId: u.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
    // Tenant-less session: isolates ineligibility from stale-tenant state
    // (a selected tenant on an ineligible account is correctly a 403).
    const { token } = await sessionToken(u)
    try {
      await u.update({ status: 'inactive' })
      expect((await get(token)).status).toBe(401)
    } finally {
      await db.tenantMembership.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      if (db.authorizationContextSession) {
        await db.authorizationContextSession.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      }
      await db.user.destroy({ where: { id: u.id }, force: true }).catch(() => {})
    }
  })

  test('revoked session is 401', async () => {
    const { token, sessionId } = await sessionToken(storeAdminA, tenantA.id, storeA1.id)
    await mw.revokeContextSession(db, sessionId, storeAdminA.id)
    expect((await get(token)).status).toBe(401)
  })
})

describe('AUD-3 permissions', () => {
  test.each(['cashier', 'staff'])('%s list and detail are 403', async (who) => {
    const token = who === 'cashier' ? cashierToken : staffToken
    expect((await get(token).query({ entity: `${P}ORDER` })).status).toBe(403)
    expect((await detail(token, 101)).status).toBe(403)
  })
})

describe('AUD-3 tenant admin', () => {
  test('sees own tenant stores (A1+A2) with scoped count', async () => {
    const res = await get(tenantAdminToken).query({ entity: `${P}ORDER` })
    expect(res.status).toBe(200)
    const ids = res.body.data.map((r) => r.id)
    expect(ids).toContain(rowA1Id)
    expect(ids).toContain(rowA2Id)
    expect(ids).not.toContain(rowB1Id)
    expect(res.body.pagination.total).toBe(res.body.data.length)
  })

  test('cannot see foreign tenant rows', async () => {
    const res = await get(tenantAdminToken).query({ entity: `${P}ORDER`, limit: 100 })
    expect(res.body.data.map((r) => r.id)).not.toContain(rowB1Id)
  })

  test('cannot expand scope via ?storeId or ?tenantId', async () => {
    const viaStore = await get(tenantAdminToken).query({ entity: `${P}ORDER`, store: storeB1.id })
    expect(viaStore.status).toBe(403)
    const viaTenant = await get(tenantAdminToken).query({ entity: `${P}ORDER`, tenantId: tenantB.id })
    expect(viaTenant.status).toBe(200)
    expect(viaTenant.body.data.map((r) => r.id)).not.toContain(rowB1Id)
  })

  test('foreign detail returns no payload', async () => {
    const res = await detail(tenantAdminToken, 201)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.pagination.total).toBe(0)
  })
})

describe('AUD-3 store admin', () => {
  test('sees assigned store only', async () => {
    const res = await get(storeAdminToken).query({ entity: `${P}ORDER` })
    expect(res.status).toBe(200)
    const ids = res.body.data.map((r) => r.id)
    expect(ids).toContain(rowA1Id)
    expect(ids).not.toContain(rowA2Id)
    expect(ids).not.toContain(rowB1Id)
    expect(res.body.pagination.total).toBe(res.body.data.length)
  })

  test('denied after assignment revocation (before JWT expiry)', async () => {
    const u = await mkUser('revoke', 'admin', storeA1)
    await db.tenantMembership.create({ userId: u.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
    await db.storeAssignment.create({ userId: u.id, tenantId: tenantA.id, storeId: storeA1.id })
    const { token } = await sessionToken(u, tenantA.id, storeA1.id)
    try {
      expect((await get(token).query({ entity: `${P}ORDER` })).status).toBe(200)
      await db.storeAssignment.destroy({ where: { userId: u.id }, force: true })
      expect((await get(token).query({ entity: `${P}ORDER` })).status).toBe(403)
    } finally {
      await db.storeAssignment.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      await db.tenantMembership.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      if (db.authorizationContextSession) {
        await db.authorizationContextSession.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      }
      await db.user.destroy({ where: { id: u.id }, force: true }).catch(() => {})
    }
  })

  test('denied after membership revocation (before JWT expiry)', async () => {
    const u = await mkUser('memrevoke', 'admin', storeA1)
    await db.tenantMembership.create({ userId: u.id, tenantId: tenantA.id, role: 'store_admin', status: 'ACTIVE' })
    await db.storeAssignment.create({ userId: u.id, tenantId: tenantA.id, storeId: storeA1.id })
    const { token } = await sessionToken(u, tenantA.id, storeA1.id)
    try {
      expect((await get(token).query({ entity: `${P}ORDER` })).status).toBe(200)
      await db.tenantMembership.update({ status: 'DEACTIVATED' }, { where: { userId: u.id } })
      expect((await get(token).query({ entity: `${P}ORDER` })).status).toBe(403)
    } finally {
      await db.storeAssignment.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      await db.tenantMembership.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      if (db.authorizationContextSession) {
        await db.authorizationContextSession.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      }
      await db.user.destroy({ where: { id: u.id }, force: true }).catch(() => {})
    }
  })
})

describe('AUD-3 platform', () => {
  test('sees all rows including null-scope and tenant-less history', async () => {
    const res = await get(platformToken).query({ entity: `${P}ORDER`, limit: 100 })
    expect(res.status).toBe(200)
    const ids = res.body.data.map((r) => r.id)
    for (const id of [rowA1Id, rowA2Id, rowB1Id, rowHistTenantNullId]) {
      expect(ids).toContain(id)
    }
    const sys = await get(platformToken).query({ entity: `${P}SYSTEM` })
    expect(sys.body.data.map((r) => r.id)).toContain(rowNullScopeId)
  })

  test('cookies cannot alter platform scope', async () => {
    const res = await get(platformToken)
      .set('Cookie', `store=${storeA1.id}`)
      .query({ entity: `${P}ORDER`, limit: 100 })
    expect(res.status).toBe(200)
    const ids = res.body.data.map((r) => r.id)
    expect(ids).toContain(rowB1Id)
  })
})

describe('AUD-3 store-bound super_admin regression', () => {
  test('is not platform: no foreign, no foreign tenant, no null-scope rows', async () => {
    const scoped = await get(boundSuperToken).query({ entity: `${P}ORDER`, limit: 100 })
    expect(scoped.status).toBe(200)
    const ids = scoped.body.data.map((r) => r.id)
    expect(ids).toContain(rowA1Id)
    expect(ids).not.toContain(rowB1Id)
    const sys = await get(boundSuperToken).query({ entity: `${P}SYSTEM` })
    expect(sys.status).toBe(200)
    expect(sys.body.data.map((r) => r.id)).not.toContain(rowNullScopeId)
  })

  test('forged super_admin JWT claims on an ordinary session stay constrained', async () => {
    const { token } = await sessionToken(storeAdminA, tenantA.id, storeA1.id, {
      roleType: 'super_admin',
      store: storeB1.id
    })
    const res = await get(token).query({ entity: `${P}ORDER`, limit: 100 })
    expect(res.status).toBe(200)
    const ids = res.body.data.map((r) => r.id)
    expect(ids).toContain(rowA1Id)
    expect(ids).not.toContain(rowB1Id)
  })
})

describe('AUD-3 legacy bypass attempts', () => {
  test('query/body/cookie store and tenant values cannot expand scope', async () => {
    const forgedQuery = await get(storeAdminToken)
      .query({ entity: `${P}ORDER`, store: storeB1.id, tenantId: tenantB.id })
    expect(forgedQuery.status).toBe(403)

    const forgedCookie = await get(storeAdminToken)
      .set('Cookie', `store=${storeB1.id}`)
      .query({ entity: `${P}ORDER` })
    expect([200, 403]).toContain(forgedCookie.status)
    if (forgedCookie.status === 200) {
      expect(forgedCookie.body.data.map((r) => r.id)).not.toContain(rowB1Id)
    }

    const forgedJwt = await sessionToken(storeAdminA, tenantA.id, storeA1.id, { store: storeB1.id })
    const res = await get(forgedJwt.token).query({ entity: `${P}ORDER`, limit: 100 })
    expect(res.status).toBe(200)
    expect(res.body.data.map((r) => r.id)).not.toContain(rowB1Id)
  })
})

describe('AUD-3 lifecycle', () => {
  test('inactive-store history stays visible; retired/quarantined/deleted hidden', async () => {
    const res = await get(tenantAdminToken).query({ entity: `${P}ORDER`, limit: 100 })
    expect(res.status).toBe(200)
    const ids = res.body.data.map((r) => r.id)
    expect(ids).toContain(rowInactiveId)
    expect(ids).not.toContain(rowRetiredId)
    expect(ids).not.toContain(rowQuarantinedId)
  })

  test('deleted-store rows are denied', async () => {
    const s = await db.location.create({ name: `${P}STORE_DEL`, status: 'active', tenantId: tenantA.id })
    const row = await recordAudit({
      actor: { type: 'USER', id: tenantAdminA.id },
      action: 'CREATE',
      entity: `${P}ORDER`,
      entityId: 501,
      storeId: s.id,
      tenantId: tenantA.id,
      description: `${P}row-del`
    })
    try {
      expect((await get(tenantAdminToken).query({ entity: `${P}ORDER`, limit: 100 })).body.data.map((r) => r.id)).toContain(row.id)
      await s.destroy()
      const after = await get(tenantAdminToken).query({ entity: `${P}ORDER`, limit: 100 })
      expect(after.body.data.map((r) => r.id)).not.toContain(row.id)
    } finally {
      await db.auditLog.destroy({ where: { id: row.id }, force: true, __auditMaintenance: true }).catch(() => {})
      await db.location.destroy({ where: { id: s.id }, force: true }).catch(() => {})
    }
  })

  test('suspended tenant invalidates context', async () => {
    const t = await db.tenant.create({ code: `${P}S`, name: `${P}Tenant S` })
    const st = await db.location.create({ name: `${P}STORE_S`, status: 'active', tenantId: t.id })
    const u = await mkUser('susp', 'admin', st)
    await db.tenantMembership.create({ userId: u.id, tenantId: t.id, role: 'store_admin', status: 'ACTIVE' })
    await db.storeAssignment.create({ userId: u.id, tenantId: t.id, storeId: st.id })
    const { token } = await sessionToken(u, t.id, st.id)
    try {
      expect((await get(token)).status).toBe(200)
      await t.update({ status: 'suspended' })
      expect((await get(token)).status).toBe(403)
    } finally {
      await db.storeAssignment.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      await db.tenantMembership.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      if (db.authorizationContextSession) {
        await db.authorizationContextSession.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      }
      await db.user.destroy({ where: { id: u.id }, force: true }).catch(() => {})
      await db.location.destroy({ where: { id: st.id }, force: true }).catch(() => {})
      await db.tenant.destroy({ where: { id: t.id }, force: true }).catch(() => {})
    }
  })

  test('deleted tenant invalidates context', async () => {
    const t = await db.tenant.create({ code: `${P}D`, name: `${P}Tenant D` })
    const st = await db.location.create({ name: `${P}STORE_D`, status: 'active', tenantId: t.id })
    const u = await mkUser('del', 'admin', st)
    await db.tenantMembership.create({ userId: u.id, tenantId: t.id, role: 'store_admin', status: 'ACTIVE' })
    await db.storeAssignment.create({ userId: u.id, tenantId: t.id, storeId: st.id })
    const { token } = await sessionToken(u, t.id, st.id)
    try {
      expect((await get(token)).status).toBe(200)
      await t.destroy()
      expect((await get(token)).status).toBe(403)
    } finally {
      await db.storeAssignment.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      await db.tenantMembership.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      if (db.authorizationContextSession) {
        await db.authorizationContextSession.destroy({ where: { userId: u.id }, force: true }).catch(() => {})
      }
      await db.user.destroy({ where: { id: u.id }, force: true }).catch(() => {})
      await db.location.destroy({ where: { id: st.id }, force: true }).catch(() => {})
      await db.tenant.destroy({ where: { id: t.id }, force: true }).catch(() => {})
    }
  })
})

describe('AUD-3 historical rows', () => {
  test('store-attributed tenant-null history is visible via current roster, never written back', async () => {
    const res = await get(tenantAdminToken).query({ entity: `${P}ORDER`, limit: 100 })
    expect(res.body.data.map((r) => r.id)).toContain(rowHistTenantNullId)
    const fresh = await db.auditLog.findByPk(rowHistTenantNullId)
    expect(fresh.tenantId).toBeNull()
  })

  test('null-store rows are platform-only', async () => {
    const admin = await get(tenantAdminToken).query({ entity: `${P}SYSTEM` })
    expect(admin.body.data.map((r) => r.id)).not.toContain(rowNullScopeId)
    const platform = await get(platformToken).query({ entity: `${P}SYSTEM` })
    expect(platform.body.data.map((r) => r.id)).toContain(rowNullScopeId)
  })

  test('foreign historical rows stay hidden with scoped counts', async () => {
    const res = await get(storeAdminToken).query({ entity: `${P}ORDER`, limit: 100 })
    const ids = res.body.data.map((r) => r.id)
    expect(ids).not.toContain(rowB1Id)
    expect(res.body.pagination.total).toBe(ids.length)
  })
})

describe('AUD-3 pagination parity', () => {
  test('count uses the exact canonical predicate as rows', async () => {
    const first = await get(tenantAdminToken).query({ entity: `${P}ORDER`, limit: 1, page: 1 })
    expect(first.status).toBe(200)
    expect(first.body.data).toHaveLength(1)
    const full = await get(tenantAdminToken).query({ entity: `${P}ORDER`, limit: 100 })
    expect(first.body.pagination.total).toBe(full.body.data.length)
    expect(full.body.data.map((r) => r.id)).not.toContain(rowB1Id)
  })
})

describe('AUD-3 audit-of-audit', () => {
  test('denied access records a DENIED event with canonical attribution', async () => {
    await get(cashierToken).query({ entity: `${P}ORDER` })
    const denied = await db.auditLog.findAll({
      where: { entity: 'auditLog', result: 'DENIED', userId: cashierA.id },
      order: [['id', 'DESC']],
      limit: 5
    })
    expect(denied.length).toBeGreaterThan(0)
    const evt = denied[0]
    // Attribution from canonical context: tenant-active cashier, own store —
    // never from cookies, JWT claims, or query/body values.
    expect(evt.tenantId).toBe(tenantA.id)
    expect(evt.store).toBe(storeA1.id)
    expect(evt.actorType).toBe('USER')
  })
})
