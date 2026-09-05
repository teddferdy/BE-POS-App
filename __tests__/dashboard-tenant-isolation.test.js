process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let storeA = null
let storeB = null
let userA = null
let adminAToken = null

beforeAll(async () => {
  storeA = await db.location.create({ name: 'DASH_ISO_STORE_A', status: 'active' })
  storeB = await db.location.create({ name: 'DASH_ISO_STORE_B', status: 'active' })

  await db.member.create({ store: storeA.id, name: 'Member A', phoneNumber: '0800000001' })
  await db.member.create({ store: storeB.id, name: 'Member B', phoneNumber: '0800000002' })

  userA = await db.user.create({
    userName: 'dash_iso_user_a',
    email: 'dash_iso_user_a@test.com',
    roleType: 'admin',
    userType: 'admin',
    store: storeA.id,
    status: 'active'
  })
  await db.user.create({
    userName: 'dash_iso_user_b',
    email: 'dash_iso_user_b@test.com',
    roleType: 'admin',
    userType: 'admin',
    store: storeB.id,
    status: 'active'
  })

  await db.order.create({
    orderNumber: `DASH-ISO-A-${Date.now()}`,
    store: storeA.id,
    status: 'paid',
    paymentStatus: 'paid',
    totalPrice: 15000,
    createdAt: new Date(),
    updatedAt: new Date()
  })
  await db.order.create({
    orderNumber: `DASH-ISO-B-${Date.now()}`,
    store: storeB.id,
    status: 'paid',
    paymentStatus: 'paid',
    totalPrice: 40000,
    createdAt: new Date(),
    updatedAt: new Date()
  })

  adminAToken = jwt.sign(
    { id: userA.id, userName: userA.userName, roleType: 'admin', store: storeA.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.order.destroy({ where: { store: [storeA.id, storeB.id] }, force: true })
  await db.member.destroy({ where: { store: [storeA.id, storeB.id] }, force: true })
  await db.user.destroy({ where: { store: [storeA.id, storeB.id] }, force: true })
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id] }, force: true })
})

describe('Dashboard endpoints must not leak cross-tenant data when ?store= is omitted', () => {
  // For every endpoint below, adminAToken belongs only to storeA. Before
  // the fix, omitting ?store= (which the route-level validateStoreAccess
  // middleware allows — it only rejects a MISMATCHED store, not a missing
  // one) fell through to reading req.query.store directly in the
  // controller, which is undefined when omitted, and every one of these
  // endpoints then returned platform-wide data instead of stopping at
  // storeA. req.storeId (what the middleware actually verified and set)
  // must be what the controller uses instead.

  test('GET /overview/location does not count every location in the deployment', async () => {
    const res = await request(app)
      .get('/overview/location')
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
  })

  test('GET /overview/user does not count every user in the deployment', async () => {
    const res = await request(app)
      .get('/overview/user')
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
  })

  test('GET /overview/member does not count every member in the deployment', async () => {
    const res = await request(app)
      .get('/overview/member')
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
  })

  test('GET /overview/locations/latest only returns the caller\'s own location', async () => {
    const res = await request(app)
      .get('/overview/locations/latest')
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data[0].id).toBe(storeA.id)
  })

  test('GET /best-selling/get-chart-current-and-seven-days-before scopes order counts to the caller\'s own store', async () => {
    const res = await request(app)
      .get('/best-selling/get-chart-current-and-seven-days-before')
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(res.status).toBe(200)
    // storeA has 1 order today; storeB's order must not be counted in.
    const today = res.body.data.find((d) => Number(d.count) > 0)
    expect(today).toBeDefined()
    expect(Number(today.count)).toBe(1)
  })

  test('GET /best-selling/get-earning-today scopes revenue to the caller\'s own store', async () => {
    const res = await request(app)
      .get('/best-selling/get-earning-today')
      .set('Authorization', `Bearer ${adminAToken}`)
    expect(res.status).toBe(200)
    // Only storeA's 15000 order, never storeB's 40000 — 55000 would mean
    // the leak is back.
    expect(Number(res.body.data.totalEarningToday)).toBe(15000)
    expect(Number(res.body.data.totalSellingToday)).toBe(1)
  })
})
