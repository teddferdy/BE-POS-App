process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const mw = require('../utils/authorizationContextMiddleware')

// Cloudinary has no test credentials: mock the storage module (suite-local
// registry only) so image-flow behavior is exercised without network.
jest.mock('../utils/cloudinaryStorage', () => ({
  uploadToCloudinaryWithDedup: jest.fn(),
  deleteFromCloudinary: jest.fn()
}))
const {
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
} = require('../utils/cloudinaryStorage')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// W3 store configuration contract (PUT /location/store-configuration).
//
// - Admission is canonical (store.manage): platform_admin cross-tenant,
//   tenant_admin own-tenant; store_admin/cashier/staff denied without any
//   permission-model change; store-bound legacy super_admin without
//   memberships denied.
// - Explicit allowlist only: immutable/unknown keys are 400 and persist
//   nothing (guards against passthrough mass-assignment regressions).
// - Configuration-only: status/ownership never mutate; terminal states
//   (closed/retired/quarantined) are 422; soft-deleted rows are 404.

const stamp = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
// W3 selector format is unpadded (^loc-[1-9]\d*$); the shared detail projector
// zero-pads displayed identity to 3 digits. Keep both forms explicit.
const locId = (id) => `loc-${id}`
const projectedId = (id) => `loc-${String(id).padStart(3, '0')}`
const projectedStoreId = (id) => `ST-${String(id).padStart(3, '0')}`

const nextLocationId = async () => {
  const [rows] = await db.sequelize.query("SELECT nextval('location_id_seq') AS id")
  return Number(rows?.[0]?.id)
}

const userIds = []
const tenantIds = []
const storeIds = []

const makeUser = async (attrs) => {
  const user = await db.user.create({
    userName: `w3_${attrs.role}_${stamp()}`,
    email: `w3_${stamp()}@test.com`,
    status: 'active',
    ...attrs
  })
  userIds.push(user.id)
  return user
}

const makeTenant = async () => {
  const tenant = await db.tenant.create({
    code: `W3_${stamp()}`.slice(0, 50),
    name: `W3 Tenant ${stamp()}`
  })
  tenantIds.push(tenant.id)
  return tenant
}

const makeStore = async (tenantId, status = 'active', overrides = {}) => {
  const row = await db.location.create({
    id: await nextLocationId(),
    store: null,
    tenantId,
    name: `W3STORE_${stamp()}`,
    status,
    ...overrides
  })
  storeIds.push(row.id)
  return row
}

const member = (user, tenant, role) =>
  db.tenantMembership.create({ userId: user.id, tenantId: tenant.id, role, status: 'ACTIVE' })

const assign = (user, store) =>
  db.storeAssignment.create({ userId: user.id, tenantId: store.tenantId, storeId: store.id })

const sessionFor = async (user, tenantId = null) => {
  const s = await mw.createContextSession(db, { userId: user.id })
  if (tenantId != null) await mw.switchSessionTenant(db, s.sessionId, user.id, tenantId)
  return jwt.sign({ id: user.id, sessionId: s.sessionId }, JWT_SECRET)
}

const put = (token, body) => {
  const r = request(app).put('/location/store-configuration')
  if (token) r.set('Authorization', `Bearer ${token}`)
  return r.send(body)
}

const pollFor = async (finder, tries = 25) => {
  for (let i = 0; i < tries; i++) {
    const found = await finder()
    if (found) return found
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return null
}

let tenantA
let tenantB
let storeA1
let storeA2
let storeB1
let storeTenantless
let storeInactive
let storeDraft
let storeClosed
let storeRetired
let storeQuarantined
let storeDeleted
let platformToken
let tenantAdminAToken
let tenantAdminBToken
let storeAdminToken
let cashierToken
let staffToken
let boundSuperToken

beforeAll(async () => {
  tenantA = await makeTenant()
  tenantB = await makeTenant()

  storeA1 = await makeStore(tenantA.id, 'active')
  storeA2 = await makeStore(tenantA.id, 'active')
  storeB1 = await makeStore(tenantB.id, 'active')
  storeTenantless = await makeStore(null, 'draft')
  storeInactive = await makeStore(tenantA.id, 'inactive')
  storeDraft = await makeStore(tenantA.id, 'draft')
  storeClosed = await makeStore(tenantA.id, 'closed')
  storeRetired = await makeStore(tenantA.id, 'retired')
  storeQuarantined = await makeStore(tenantA.id, 'quarantined')
  storeDeleted = await makeStore(tenantA.id, 'active')
  await db.location.destroy({ where: { id: storeDeleted.id } })

  const platform = await makeUser({ roleType: 'super_admin', store: null })
  platformToken = await sessionFor(platform)

  const tenantAdminA = await makeUser({ roleType: 'admin', store: null })
  await member(tenantAdminA, tenantA, 'tenant_admin')
  tenantAdminAToken = await sessionFor(tenantAdminA, tenantA.id)

  const tenantAdminB = await makeUser({ roleType: 'admin', store: null })
  await member(tenantAdminB, tenantB, 'tenant_admin')
  tenantAdminBToken = await sessionFor(tenantAdminB, tenantB.id)

  const storeAdmin = await makeUser({ roleType: 'admin', store: null })
  await member(storeAdmin, tenantA, 'store_admin')
  await assign(storeAdmin, storeA1)
  storeAdminToken = await sessionFor(storeAdmin, tenantA.id)

  const cashier = await makeUser({ roleType: 'kasir', store: null })
  await member(cashier, tenantA, 'cashier')
  await assign(cashier, storeA1)
  cashierToken = await sessionFor(cashier, tenantA.id)

  const staff = await makeUser({ roleType: 'user', store: null })
  await member(staff, tenantA, 'staff')
  staffToken = await sessionFor(staff, tenantA.id)

  const boundSuper = await makeUser({ roleType: 'super_admin', store: storeA1.id })
  boundSuperToken = await sessionFor(boundSuper)
}, 60000)

afterAll(async () => {
  const loud = (label) => (error) => {
    if (error) console.error(`W3 cleanup ${label}:`, error.message)
  }
  await db.authorizationContextSession.destroy({ where: { userId: userIds }, force: true }).catch(loud('sessions'))
  await db.storeAssignment.destroy({ where: { userId: userIds }, force: true }).catch(loud('assignments'))
  await db.tenantMembership.destroy({ where: { userId: userIds }, force: true }).catch(loud('memberships'))
  // user.store carries a DB-level FK to location (user_store_fkey): null it
  // before removing the referenced stores.
  await db.user.update({ store: null }, { where: { id: userIds } }).catch(loud('user-store'))
  await db.location.destroy({ where: { id: storeIds }, force: true }).catch(loud('locations'))
  await db.user.destroy({ where: { id: userIds }, force: true }).catch(loud('users'))
  await db.tenant.destroy({ where: { id: tenantIds }, force: true }).catch(loud('tenants'))
  // Fire-and-forget audit/notification writes from the last tests may still
  // be in flight: settle, then sweep.
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await db.auditLog
    .destroy({ where: { userId: userIds }, __auditMaintenance: true })
    .catch(loud('auditLog'))
  await db.notification
    .destroy({ where: { referenceType: 'location', referenceId: storeIds }, force: true })
    .catch(loud('notification'))
})

describe('W3 actor admission', () => {
  test('platform_admin configures a store', async () => {
    const res = await put(platformToken, { id: locId(storeA1.id), managerName: 'W3 Platform' })
    expect(res.status).toBe(200)
    expect(res.body.data.managerName).toBe('W3 Platform')
    await storeA1.reload()
    expect(storeA1.managerName).toBe('W3 Platform')
  })

  test('tenant_admin configures an own-tenant store', async () => {
    const res = await put(tenantAdminAToken, { id: locId(storeA2.id), phoneNumber: '081111111111' })
    expect(res.status).toBe(200)
    expect(res.body.data.phoneNumber).toBe('081111111111')
  })

  test('store_admin is denied without a permission grant', async () => {
    const res = await put(storeAdminToken, { id: locId(storeA1.id), managerName: 'W3 Denied' })
    expect(res.status).toBe(403)
    await storeA1.reload()
    expect(storeA1.managerName).not.toBe('W3 Denied')
  })

  test('cashier is denied', async () => {
    const res = await put(cashierToken, { id: locId(storeA1.id), managerName: 'W3 Denied' })
    expect(res.status).toBe(403)
  })

  test('staff is denied', async () => {
    const res = await put(staffToken, { id: locId(storeA1.id), managerName: 'W3 Denied' })
    expect(res.status).toBe(403)
  })

  test('unauthenticated is 401', async () => {
    const res = await put(null, { id: locId(storeA1.id), managerName: 'W3 Denied' })
    expect(res.status).toBe(401)
  })

  test('store-bound legacy super_admin without memberships is denied', async () => {
    const res = await put(boundSuperToken, { id: locId(storeA1.id), managerName: 'W3 Denied' })
    expect(res.status).toBe(403)
    await storeA1.reload()
    expect(storeA1.managerName).not.toBe('W3 Denied')
  })
})

describe('W3 tenant isolation', () => {
  test('tenant_admin cannot mutate another tenant store', async () => {
    const before = (await db.location.findByPk(storeB1.id)).managerName
    const res = await put(tenantAdminAToken, { id: locId(storeB1.id), managerName: 'W3 Cross' })
    expect(res.status).toBe(403)
    expect((await db.location.findByPk(storeB1.id)).managerName).toBe(before)
    const reverse = await put(tenantAdminBToken, { id: locId(storeA1.id), managerName: 'W3 Cross' })
    expect(reverse.status).toBe(403)
  })

  test('tenant_admin cannot mutate a tenantless row', async () => {
    const res = await put(tenantAdminAToken, { id: locId(storeTenantless.id), managerName: 'W3 Cross' })
    expect(res.status).toBe(403)
  })

  test('platform_admin configures cross-tenant and tenantless rows', async () => {
    const cross = await put(platformToken, { id: locId(storeB1.id), managerName: 'W3 Platform B' })
    expect(cross.status).toBe(200)
    const tenantless = await put(platformToken, { id: locId(storeTenantless.id), managerName: 'W3 Platform T' })
    expect(tenantless.status).toBe(200)
  })

  test('missing, foreign and malformed selectors are indistinguishable', async () => {
    const missing = await put(tenantAdminAToken, { id: 'loc-2000000000', managerName: 'x' })
    const foreign = await put(tenantAdminAToken, { id: locId(storeB1.id), managerName: 'x' })
    const malformed = await put(tenantAdminAToken, { id: 'loc-abc', managerName: 'x' })
    expect(missing.status).toBe(403)
    expect(foreign.status).toBe(403)
    expect(malformed.status).toBe(403)
  })
})

describe('W3 explicit allowlist', () => {
  test('every admitted field persists', async () => {
    const openingHours = [{ day: 'Monday', open: '08:00', close: '17:00', is24Hours: false }]
    const socialMedia = [{ platform: 'instagram', account: '@w3store' }]
    const res = await put(platformToken, {
      id: locId(storeA2.id),
      name: `W3 Renamed ${stamp()}`,
      phoneNumber: '082222222222',
      email: 'w3store@test.com',
      address: 'Jl. W3 No. 1',
      detailLocation: 'Near W3',
      province: '31',
      city: '3171',
      district: '3171010',
      village: '3171010001',
      postalCode: '10110',
      description: 'W3 description',
      category: 'W3 Category',
      managerName: 'W3 Manager',
      latitude: '-6.2',
      longitude: '106.8',
      image: 'https://img.test/manual.png',
      openingHours,
      socialMedia,
      timezone: 'Asia/Makassar',
      mainBranch: true,
      dailyTarget: 1500000,
      maxActiveParkedCarts: 10,
      parkedCartTtlMinutes: 60
    })
    expect(res.status).toBe(200)
    const row = await db.location.findByPk(storeA2.id)
    expect(row.phoneNumber).toBe('082222222222')
    expect(row.email).toBe('w3store@test.com')
    expect(row.address).toBe('Jl. W3 No. 1')
    expect(row.timezone).toBe('Asia/Makassar')
    expect(row.mainBranch).toBe(true)
    expect(Number(row.dailyTarget)).toBe(1500000)
    expect(Number(row.maxActiveParkedCarts)).toBe(10)
    expect(Number(row.parkedCartTtlMinutes)).toBe(60)
    expect(row.image).toBe('https://img.test/manual.png')
    expect(Array.isArray(row.openingHours)).toBe(true)
    expect(row.openingHours[0]).toMatchObject({ day: 'Monday', open: '08:00', close: '17:00', is24Hours: false })
    expect(row.socialMedia).toEqual(socialMedia)
    // Identity, ownership and lifecycle untouched.
    expect(row.id).toBe(storeA2.id)
    expect(row.store).toBe(storeA2.store)
    expect(Number(row.tenantId)).toBe(Number(tenantA.id))
    expect(row.status).toBe('active')
  })

  test.each([
    ['store', 999999999],
    ['tenantId', 1],
    ['status', 'inactive'],
    ['isActive', false],
    ['locationId', 'loc-999999999'],
    ['storeId', 'ST-999999999'],
    ['createdBy', 1],
    ['modifiedBy', 1],
    ['deletedAt', new Date().toISOString()]
  ])('immutable field %s is 400 and persists nothing', async (field, value) => {
    const before = { ...(await db.location.findByPk(storeA1.id)).dataValues }
    const res = await put(platformToken, { id: locId(storeA1.id), [field]: value })
    expect(res.status).toBe(400)
    const after = (await db.location.findByPk(storeA1.id)).dataValues
    expect(after.managerName).toBe(before.managerName)
    expect(after.phoneNumber).toBe(before.phoneNumber)
    expect(Number(after.store)).toBe(Number(before.store))
    expect(String(after.tenantId)).toBe(String(before.tenantId))
    expect(after.status).toBe(before.status)
  })

  test('arbitrary unknown fields are 400 and persist nothing', async () => {
    const before = (await db.location.findByPk(storeA1.id)).managerName
    const res = await put(platformToken, {
      id: locId(storeA1.id),
      hackerField: 'x',
      cashOutApprovalThreshold: 1,
      cashVarianceThreshold: 1
    })
    expect(res.status).toBe(400)
    expect((await db.location.findByPk(storeA1.id)).managerName).toBe(before)
  })

  test('deferred financial thresholds are not admitted', async () => {
    const res = await put(platformToken, {
      id: locId(storeA1.id),
      cashOutApprovalThreshold: 750000
    })
    expect(res.status).toBe(400)
  })

  test('missing selector is denied without revealing anything', async () => {
    // The permission gate precedes schema validation, so a missing selector
    // fails closed (403) exactly like a missing/foreign/malformed one.
    const res = await put(platformToken, { managerName: 'W3 Denied' })
    expect(res.status).toBe(403)
  })

  test('selector id is lookup-only: response identity matches the row', async () => {
    const res = await put(platformToken, { id: locId(storeA1.id), managerName: 'W3 Identity' })
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(projectedId(storeA1.id))
    expect(res.body.data.storeId).toBe(projectedStoreId(storeA1.id))
    const row = await db.location.findByPk(storeA1.id)
    expect(row.id).toBe(storeA1.id)
  })
})

describe('W3 lifecycle', () => {
  test.each([
    ['active', () => storeA1],
    ['inactive', () => storeInactive],
    ['draft', () => storeDraft]
  ])('config edit on %s succeeds with status unchanged', async (status, getStore) => {
    const store = getStore()
    const res = await put(platformToken, { id: locId(store.id), managerName: `W3 ${status}` })
    expect(res.status).toBe(200)
    const row = await db.location.findByPk(store.id)
    expect(row.status).toBe(status)
    expect(row.managerName).toBe(`W3 ${status}`)
  })

  test.each([
    ['closed', () => storeClosed],
    ['retired', () => storeRetired],
    ['quarantined', () => storeQuarantined]
  ])('config edit on %s is 422 STORE_STATUS_IRREVERSIBLE', async (status, getStore) => {
    const store = getStore()
    const before = (await db.location.findByPk(store.id, { paranoid: false })).managerName
    const res = await put(platformToken, { id: locId(store.id), managerName: 'W3 Denied' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('STORE_STATUS_IRREVERSIBLE')
    expect((await db.location.findByPk(store.id, { paranoid: false })).managerName).toBe(before)
  })

  test('soft-deleted row is 404', async () => {
    const res = await put(platformToken, { id: locId(storeDeleted.id), managerName: 'W3 Denied' })
    expect(res.status).toBe(404)
  })
})

describe('W3 validation', () => {
  test('invalid timezone is 400', async () => {
    const res = await put(platformToken, { id: locId(storeA1.id), timezone: 'WIB' })
    expect(res.status).toBe(400)
  })

  test('malformed openingHours is 400', async () => {
    const res = await put(platformToken, { id: locId(storeA1.id), openingHours: '{not-json' })
    expect(res.status).toBe(400)
  })

  test('negative threshold is 400', async () => {
    const res = await put(platformToken, { id: locId(storeA1.id), dailyTarget: -5 })
    expect(res.status).toBe(400)
  })

  test('malformed numeric threshold is 400', async () => {
    const res = await put(platformToken, { id: locId(storeA1.id), maxActiveParkedCarts: 'many' })
    expect(res.status).toBe(400)
  })

  test('nullable threshold resolves to default behavior', async () => {
    const res = await put(platformToken, { id: locId(storeA1.id), parkedCartTtlMinutes: null })
    expect(res.status).toBe(200)
    expect((await db.location.findByPk(storeA1.id)).parkedCartTtlMinutes).toBeNull()
  })
})

describe('W3 image flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('valid replacement works and old image is deleted', async () => {
    uploadToCloudinaryWithDedup.mockResolvedValue({ url: 'https://img.test/w3-new.png' })
    const target = await makeStore(tenantA.id, 'active', { image: 'https://img.test/w3-old.png' })
    const res = await request(app)
      .put('/location/store-configuration')
      .set('Authorization', `Bearer ${platformToken}`)
      .field('id', locId(target.id))
      .attach('image', Buffer.from('fake-image-bytes'), 'w3.png')
    expect(res.status).toBe(200)
    expect((await db.location.findByPk(target.id)).image).toBe('https://img.test/w3-new.png')
    expect(deleteFromCloudinary).toHaveBeenCalledWith('https://img.test/w3-old.png')
  })

  test('duplicate image returns 409', async () => {
    uploadToCloudinaryWithDedup.mockResolvedValue({ url: 'https://img.test/w3-dup.png' })
    const holder = await makeStore(tenantA.id, 'active', { image: 'https://img.test/w3-dup.png' })
    const target = await makeStore(tenantA.id, 'active')
    const res = await request(app)
      .put('/location/store-configuration')
      .set('Authorization', `Bearer ${platformToken}`)
      .field('id', locId(target.id))
      .attach('image', Buffer.from('fake-image-bytes'), 'w3.png')
    expect(res.status).toBe(409)
    expect(await db.location.findByPk(holder.id)).not.toBeNull()
  })
})

describe('W3 audit', () => {
  test('update produces the existing location update audit event', async () => {
    const marker = `W3 Audit ${stamp()}`
    const res = await put(platformToken, { id: locId(storeA2.id), managerName: marker })
    expect(res.status).toBe(200)
    const row = await pollFor(() =>
      db.auditLog.findOne({
        where: { entity: 'location', entityId: storeA2.id, action: 'update' },
        order: [['createdAt', 'DESC']]
      })
    )
    expect(row).not.toBeNull()
    expect(String(row.description)).toContain('Updated store configuration')
  })
})

describe('W3 concurrency', () => {
  test('concurrent edits stay coherent with no identity/tenant/status corruption', async () => {
    const results = await Promise.all([
      put(platformToken, { id: locId(storeA1.id), managerName: 'W3 Concurrency' }),
      put(platformToken, { id: locId(storeA1.id), phoneNumber: '083333333333' }),
      put(platformToken, { id: locId(storeA1.id), timezone: 'Asia/Makassar' }),
      put(platformToken, { id: locId(storeA1.id), dailyTarget: 777000 })
    ])
    for (const res of results) expect(res.status).toBe(200)
    const row = await db.location.findByPk(storeA1.id)
    expect(row.managerName).toBe('W3 Concurrency')
    expect(row.phoneNumber).toBe('083333333333')
    expect(row.timezone).toBe('Asia/Makassar')
    expect(Number(row.dailyTarget)).toBe(777000)
    expect(row.id).toBe(storeA1.id)
    expect(Number(row.tenantId)).toBe(Number(tenantA.id))
    expect(row.status).toBe('active')
  })
})
