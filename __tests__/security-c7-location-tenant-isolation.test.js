process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let storeA, storeB, tokenA, tokenB, superToken

describe('C-7 location detail — tenant isolation', () => {
  beforeAll(async () => {
    storeA = await db.location.create({
      name: 'C7_STORE_A',
      status: 'active',
      phoneNumber: '111-AAA',
      email: 'storeA-canary@example.com',
      managerName: 'Manager A Canary',
      dailyTarget: 111111
    })
    storeB = await db.location.create({
      name: 'C7_STORE_B',
      status: 'active',
      phoneNumber: '222-BBB',
      email: 'storeB-canary@example.com',
      managerName: 'Manager B Canary',
      dailyTarget: 222222
    })

    tokenA = jwt.sign(
      { id: 88801, userName: 'c7_admin_a', roleType: 'admin', store: storeA.id },
      JWT_SECRET
    )
    tokenB = jwt.sign(
      { id: 88802, userName: 'c7_admin_b', roleType: 'admin', store: storeB.id },
      JWT_SECRET
    )
    superToken = jwt.sign(
      { id: 88803, userName: 'c7_super', roleType: 'super_admin', store: null },
      JWT_SECRET
    )
  })

  afterAll(async () => {
    await db.location.destroy({ where: { id: [storeA.id, storeB.id] }, force: true })
  })

  test('store A admin CANNOT read store B location detail (no canary leak)', async () => {
    const res = await request(app)
      .get(`/location/get-location-detail/loc-${storeB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).not.toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('storeB-canary@example.com')
    expect(JSON.stringify(res.body)).not.toContain('Manager B Canary')
    expect(JSON.stringify(res.body)).not.toContain('222222')
  })

  test('store B admin CANNOT read store A location detail (no canary leak)', async () => {
    const res = await request(app)
      .get(`/location/get-location-detail/loc-${storeA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).not.toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('storeA-canary@example.com')
  })

  test('store A admin CAN read its own location detail', async () => {
    const res = await request(app)
      .get(`/location/get-location-detail/loc-${storeA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(200)
    expect(res.body?.data?.email).toBe('storeA-canary@example.com')
  })

  test('store B admin CAN read its own location detail', async () => {
    const res = await request(app)
      .get(`/location/get-location-detail/loc-${storeB.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).toBe(200)
    expect(res.body?.data?.email).toBe('storeB-canary@example.com')
  })

  test('super_admin CAN read any store location detail (global access preserved)', async () => {
    const resA = await request(app)
      .get(`/location/get-location-detail/loc-${storeA.id}`)
      .set('Authorization', `Bearer ${superToken}`)
    const resB = await request(app)
      .get(`/location/get-location-detail/loc-${storeB.id}`)
      .set('Authorization', `Bearer ${superToken}`)

    expect(resA.status).toBe(200)
    expect(resA.body?.data?.email).toBe('storeA-canary@example.com')
    expect(resB.status).toBe(200)
    expect(resB.body?.data?.email).toBe('storeB-canary@example.com')
  })

  test('nonexistent location id returns 404, not a leak of any other store', async () => {
    const res = await request(app)
      .get('/location/get-location-detail/loc-999999999')
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(404)
  })

  test('malformed location id is handled safely (no crash, no cross-tenant leak)', async () => {
    const res = await request(app)
      .get('/location/get-location-detail/loc-not-a-number')
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).not.toBe(200)
  })
})
