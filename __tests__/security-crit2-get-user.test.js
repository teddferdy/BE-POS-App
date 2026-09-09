process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// CRIT-2 regression: GET /auth/get-user could return the entire cross-tenant
// user table when `location` was omitted, and `kasir` bypassed the guard.
//
// Required invariant: ordinary roles (user/admin/kasir) MUST only ever see
// their own store's users; omitting `location` must never mean "all stores".
// super_admin may query an explicit store, and must not accidentally dump all.

let store1 = null
let store2 = null

const mkToken = (roleType, store, id) =>
  jwt.sign(
    { id, userName: `tok_${roleType}_${id}`, roleType, store },
    JWT_SECRET
  )

let userS1A = null
let userS1B = null
let userS2A = null
let userS2B = null

const fixtureIds = []

beforeAll(async () => {
  store1 = await db.location.create({
    name: `CRIT2_STORE1_${Date.now()}`,
    status: 'active'
  })
  store2 = await db.location.create({
    name: `CRIT2_STORE2_${Date.now()}`,
    status: 'active'
  })

  const name = (p) => `${p}_${Date.now()}`

  userS1A = await db.user.create({
    userName: name('cr2s1a'),
    email: name('cr2s1amail') + '@test.com',
    roleType: 'user',
    userType: 'user',
    store: store1.id,
    status: 'active'
  })
  userS1B = await db.user.create({
    userName: name('cr2s1b'),
    email: name('cr2s1bmail') + '@test.com',
    roleType: 'user',
    userType: 'user',
    store: store1.id,
    status: 'active'
  })
  userS2A = await db.user.create({
    userName: name('cr2s2a'),
    email: name('cr2s2amail') + '@test.com',
    roleType: 'user',
    userType: 'user',
    store: store2.id,
    status: 'active'
  })
  userS2B = await db.user.create({
    userName: name('cr2s2b'),
    email: name('cr2s2bmail') + '@test.com',
    roleType: 'user',
    userType: 'user',
    store: store2.id,
    status: 'active'
  })

  fixtureIds.push(
    userS1A.id,
    userS1B.id,
    userS2A.id,
    userS2B.id
  )
})

afterAll(async () => {
  await db.user.destroy({ where: { id: fixtureIds }, force: true })
  await db.location.destroy({
    where: { id: [store1?.id, store2?.id].filter(Boolean) },
    force: true
  })
})

const getAllStoresReturned = (data) => {
  if (!Array.isArray(data)) return []
  return data.map((u) => u.store)
}

describe('CRIT-2 GET /auth/get-user tenant isolation', () => {
  test('ordinary Store-1 user without location only sees Store-1 users', async () => {
    const token = mkToken('user', store1.id, 7001)
    const res = await request(app)
      .get('/auth/get-user')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const stores = getAllStoresReturned(res.body?.data)
    expect(stores.length).toBeGreaterThan(0)
    // every returned user belongs to store1 and never store2
    expect(stores.every((s) => s === store1.id)).toBe(true)
    // and both store1 fixtures are present
    const usernames = res.body.data.map((u) => u.userName)
    expect(usernames).toContain(userS1A.userName)
    expect(usernames).toContain(userS1B.userName)
  })

  test('ordinary Store-1 user with location=Store-2 is rejected', async () => {
    const token = mkToken('user', store1.id, 7002)
    const res = await request(app)
      .get('/auth/get-user')
      .set('Authorization', `Bearer ${token}`)
      .query({ location: store2.id })

    expect([400, 403]).toContain(res.status)
  })

  test('kasir Store-1 without location only sees Store-1 users', async () => {
    const token = mkToken('kasir', store1.id, 7003)
    const res = await request(app)
      .get('/auth/get-user')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const stores = getAllStoresReturned(res.body?.data)
    expect(stores.length).toBeGreaterThan(0)
    expect(stores.every((s) => s === store1.id)).toBe(true)
  })

  test('kasir Store-1 with location=Store-2 is rejected', async () => {
    const token = mkToken('kasir', store1.id, 7004)
    const res = await request(app)
      .get('/auth/get-user')
      .set('Authorization', `Bearer ${token}`)
      .query({ location: store2.id })

    expect([400, 403]).toContain(res.status)
  })

  test('super_admin with explicit location may query that store', async () => {
    const token = mkToken('super_admin', null, 7005)
    const res = await request(app)
      .get('/auth/get-user')
      .set('Authorization', `Bearer ${token}`)
      .query({ location: store2.id })

    expect(res.status).toBe(200)
    const stores = getAllStoresReturned(res.body?.data)
    expect(stores.length).toBeGreaterThan(0)
    expect(stores.every((s) => s === store2.id)).toBe(true)
  })

  test('super_admin without location must not dump all stores globally', async () => {
    const token = mkToken('super_admin', null, 7006)
    const res = await request(app)
      .get('/auth/get-user')
      .set('Authorization', `Bearer ${token}`)

    // explicit-guard: either 400 (location required) or a store-scoped list —
    // anything EXCEPT a silent dump spanning multiple stores
    expect([400, 403]).toContain(res.status)
  })

  test('Store-1 responses never contain Store-2 users', async () => {
    const token = mkToken('admin', store1.id, 7007)
    const res = await request(app)
      .get('/auth/get-user')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const userNames = res.body.data.map((u) => u.userName)
    expect(userNames).not.toContain(userS2A.userName)
    expect(userNames).not.toContain(userS2B.userName)
  })
})