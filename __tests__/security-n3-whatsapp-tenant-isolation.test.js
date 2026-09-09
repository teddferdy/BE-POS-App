process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'
process.env.FONNTE_TOKEN = 'test-token'

// N-3 regression: pos getWhatsAppStatus/logoutWhatsApp/restartWhatsApp used
// getStoreId(req) = req.query.storeId with no tenant binding, so a store A
// admin could inspect/logout/restart store B's WhatsApp session. For
// non-super-admin the store must derive from req.storeId and any query.storeId
// targeting another store must be rejected; super_admin may explicitly target.

jest.mock('../utils/whatsappClient', () => {
  const actual = jest.requireActual('../utils/whatsappClient')
  return {
    ...actual,
    getConnectionStatus: jest.fn(async (storeId = 'default') => ({
      ready: true, hasQR: false, qrBase64: null, error: null, phoneNumber: null, storeId
    })),
    logout: jest.fn(async () => {}),
    restartClient: jest.fn(async () => true)
  }
})

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const whatsapp = require('../utils/whatsappClient')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let store1 = null
let store2 = null
let userAdmin1 = null
let userSuper = null
let admin1Token = null
let superToken = null

beforeAll(async () => {
  store1 = await db.location.create({ name: 'N3_STORE_A', status: 'active' })
  store2 = await db.location.create({ name: 'N3_STORE_B', status: 'active' })
  const suffix = Date.now()
  userAdmin1 = await db.user.create({
    id: 9501,
    userName: `n3_admin_a_${suffix}`,
    roleType: 'admin',
    store: store1.id,
    password: 'x'
  })
  userSuper = await db.user.create({
    id: 9500,
    userName: `n3_super_${suffix}`,
    roleType: 'super_admin',
    password: 'x'
  })
  admin1Token = jwt.sign(
    { id: userAdmin1.id, userName: userAdmin1.userName, roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  superToken = jwt.sign(
    { id: userSuper.id, userName: userSuper.userName, roleType: 'super_admin' },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.auditLog.destroy({ where: { userId: [userAdmin1?.id, userSuper?.id].filter(Boolean) }, force: true })
  await db.user.destroy({ where: { id: [userAdmin1?.id, userSuper?.id].filter(Boolean) }, force: true })
  await db.location.destroy({ where: { id: [store1?.id, store2?.id].filter(Boolean) }, force: true })
})

beforeEach(() => {
  whatsapp.getConnectionStatus.mockClear()
  whatsapp.logout.mockClear()
  whatsapp.restartClient.mockClear()
})

describe('N-3 POS WhatsApp session tenant isolation', () => {
  test('store A admin cannot inspect store B status via ?storeId', async () => {
    const res = await request(app)
      .get('/pos/whatsapp/status')
      .query({ storeId: store2.id })
      .set('Authorization', `Bearer ${admin1Token}`)

    expect([403, 404]).toContain(res.status)
    // must never have queried store B's session
    const calls = whatsapp.getConnectionStatus.mock.calls.map((c) => Number(c[0]))
    expect(calls).not.toContain(Number(store2.id))
  })

  test('store A admin cannot logout store B via ?storeId', async () => {
    const res = await request(app)
      .post('/pos/whatsapp/logout')
      .set('Authorization', `Bearer ${admin1Token}`)
      .query({ storeId: store2.id })

    expect([403, 404]).toContain(res.status)
    expect(whatsapp.logout).not.toHaveBeenCalled()
  })

  test('store A admin cannot restart store B via ?storeId', async () => {
    const res = await request(app)
      .post('/pos/whatsapp/restart')
      .set('Authorization', `Bearer ${admin1Token}`)
      .query({ storeId: store2.id })

    expect([403, 404]).toContain(res.status)
    expect(whatsapp.restartClient).not.toHaveBeenCalled()
  })

  test('store A admin can inspect their OWN status', async () => {
    const res = await request(app)
      .get('/pos/whatsapp/status')
      .set('Authorization', `Bearer ${admin1Token}`)

    expect(res.status).toBe(200)
    const calls = whatsapp.getConnectionStatus.mock.calls.map((c) => Number(c[0]))
    expect(calls).toContain(Number(store1.id))
  })

  test('store A admin can log out their OWN session with own storeId', async () => {
    const res = await request(app)
      .post('/pos/whatsapp/logout')
      .set('Authorization', `Bearer ${admin1Token}`)
      .query({ storeId: store1.id })

    expect(res.status).toBe(200)
    expect(whatsapp.logout).toHaveBeenCalled()
  })

  test('super_admin can explicitly target store B (intentional)', async () => {
    const res = await request(app)
      .get('/pos/whatsapp/status')
      .set('Authorization', `Bearer ${superToken}`)
      .query({ storeId: store2.id })

    expect(res.status).toBe(200)
    const calls = whatsapp.getConnectionStatus.mock.calls.map((c) => Number(c[0]))
    expect(calls).toContain(Number(store2.id))
  })
})
