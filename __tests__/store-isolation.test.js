process.env.NODE_ENV = 'development'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

const superAdminToken = jwt.sign(
  { id: 9999, userName: 'superadmin_iso', roleType: 'super_admin' },
  JWT_SECRET
)

const adminStore1Token = jwt.sign(
  { id: 9998, userName: 'admin1_iso', roleType: 'admin', store: 1 },
  JWT_SECRET
)

const adminStore2Token = jwt.sign(
  { id: 9997, userName: 'admin2_iso', roleType: 'admin', store: 2 },
  JWT_SECRET
)

const userStore1Token = jwt.sign(
  { id: 9996, userName: 'user1_iso', roleType: 'user', store: 1 },
  JWT_SECRET
)

let loc1 = null
let loc2 = null

beforeAll(async () => {
  loc1 = await db.location.create({
    store: 1,
    name: 'ISO_STORE_1',
    address: 'Jl. Isolation 1',
    phoneNumber: '081000000001',
    email: 'iso1@store.com',
    status: 'active'
  })

  loc2 = await db.location.create({
    store: 2,
    name: 'ISO_STORE_2',
    address: 'Jl. Isolation 2',
    phoneNumber: '081000000002',
    email: 'iso2@store.com',
    status: 'active'
  })
})

afterAll(async () => {
  await db.invoice_setting.destroy({
    where: { store: [1, 2] },
    force: true
  })
  await db.location.destroy({
    where: { id: [loc1?.id, loc2?.id].filter(Boolean) },
    force: true
  })
})

describe('Store data isolation — invoice settings', () => {
  test('admin store 1 cannot read store 2 invoice setting', async () => {
    await db.invoice_setting.upsert({
      store: 2,
      showStoreName: false,
      footer: 'Store 2 secret'
    })

    const res = await request(app)
      .get('/invoice/setting?store=2')
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(403)
  })

  test('admin store 1 can read own store invoice setting', async () => {
    await db.invoice_setting.upsert({
      store: 1,
      showStoreName: false,
      footer: 'Store 1 visible'
    })

    const res = await request(app)
      .get('/invoice/setting?store=1')
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.footer).toBe('Store 1 visible')
  })

  test('super_admin can read any store invoice setting', async () => {
    const res = await request(app)
      .get('/invoice/setting?store=2')
      .set('Authorization', `Bearer ${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.footer).toBe('Store 2 secret')
  })

  test('admin store 1 cannot update store 2 invoice setting', async () => {
    const res = await request(app)
      .put('/invoice/setting')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ store: 2, showStoreName: false })

    expect(res.status).toBe(403)
  })

  test('admin store 1 cannot reset store 2 invoice setting', async () => {
    const res = await request(app)
      .post('/invoice/setting/reset')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ store: 2 })

    expect(res.status).toBe(403)
  })

  test('super_admin can reset any store invoice setting', async () => {
    await db.invoice_setting.upsert({
      store: 1,
      showStoreName: false,
      footer: 'To be reset'
    })

    const res = await request(app)
      .post('/invoice/setting/reset')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ store: 1 })

    expect(res.status).toBe(200)

    const setting = await db.invoice_setting.findOne({ where: { store: 1 } })
    expect(setting.showStoreName).toBe(true)
    expect(setting.footer).toBe('Terima kasih atas kunjungan Anda')
  })
})

describe('Store data isolation — location', () => {
  test('super_admin can see all locations', async () => {
    const res = await request(app)
      .get('/location/get-location-all')
      .set('Authorization', `Bearer ${superAdminToken}`)

    expect(res.status).toBe(200)
    const names = res.body.data.map((l) => l.name)
    expect(names).toContain('ISO_STORE_1')
    expect(names).toContain('ISO_STORE_2')
  })

  test('admin store 1 cannot see store 2 location', async () => {
    const res = await request(app)
      .get('/location/get-location-all')
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(403)
  })

  test('admin store 1 can access own location detail', async () => {
    const res = await request(app)
      .get(`/location/get-location-detail/${loc1.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('ISO_STORE_1')
  })

  test('admin store 1 can access store 2 location detail (no isolation on this endpoint)', async () => {
    const res = await request(app)
      .get(`/location/get-location-detail/${loc2.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(200)
  })
})

describe('User role restrictions', () => {
  test('user role can read own store invoice setting', async () => {
    await db.invoice_setting.upsert({
      store: 1,
      showStoreName: false,
      footer: 'Store 1 user footer'
    })

    const res = await request(app)
      .get('/invoice/setting?store=1')
      .set('Authorization', `Bearer ${userStore1Token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.footer).toBe('Store 1 user footer')
  })

  test('user role cannot read other store invoice setting', async () => {
    await db.invoice_setting.upsert({
      store: 2,
      showStoreName: false,
      footer: 'Store 2 secret'
    })

    const res = await request(app)
      .get('/invoice/setting?store=2')
      .set('Authorization', `Bearer ${userStore1Token}`)

    expect(res.status).toBe(403)
  })

  test('user role cannot update invoice setting for other store', async () => {
    const res = await request(app)
      .put('/invoice/setting')
      .set('Authorization', `Bearer ${userStore1Token}`)
      .send({ store: 2, showStoreName: false })

    expect(res.status).toBe(403)
  })

  test('user role cannot update own store invoice setting (role not allowed)', async () => {
    const res = await request(app)
      .put('/invoice/setting')
      .set('Authorization', `Bearer ${userStore1Token}`)
      .send({ store: 1, showStoreName: false })

    expect(res.status).toBe(403)
  })

  test('user role cannot reset other store invoice setting', async () => {
    const res = await request(app)
      .post('/invoice/setting/reset')
      .set('Authorization', `Bearer ${userStore1Token}`)
      .send({ store: 2 })

    expect(res.status).toBe(403)
  })

  test('user cannot reset own store setting (role not allowed)', async () => {
    await db.invoice_setting.upsert({
      store: 1,
      showStoreName: false,
      footer: 'To be reset'
    })

    const res = await request(app)
      .post('/invoice/setting/reset')
      .set('Authorization', `Bearer ${userStore1Token}`)
      .send({ store: 1 })

    expect(res.status).toBe(403)
  })

  test('user cannot reset other store setting', async () => {
    const res = await request(app)
      .post('/invoice/setting/reset')
      .set('Authorization', `Bearer ${userStore1Token}`)
      .send({ store: 2 })

    expect(res.status).toBe(403)
  })
})