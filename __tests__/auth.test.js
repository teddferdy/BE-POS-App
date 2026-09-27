process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

const superAdminToken = jwt.sign(
  { id: 9999, userName: 'superauth', roleType: 'super_admin', store: null },
  JWT_SECRET
)

const adminStore1Token = jwt.sign(
  { id: 9998, userName: 'adminauth', roleType: 'admin', store: 1 },
  JWT_SECRET
)

const adminStore2Token = jwt.sign(
  { id: 9997, userName: 'admin2auth', roleType: 'admin', store: 2 },
  JWT_SECRET
)

const userStore1Token = jwt.sign(
  { id: 9996, userName: 'userauth', roleType: 'user', store: 1 },
  JWT_SECRET
)

// P1-4: central gate denies unknown caller identities; these rows satisfy
// the identity invariant. JWT claims (incl. abstract store numbers used by
// these authorization-shape tests) and all assertions are unchanged.
beforeAll(async () => {
  await db.user.create({
    id: 9999,
    userName: 'superauth',
    email: 'p14-9999-auth@test.com',
    roleType: 'super_admin',
    userType: 'admin',
    store: null,
    status: 'active',
    fullName: 'superauth'
  })
  await db.user.create({
    id: 9998,
    userName: 'adminauth',
    email: 'p14-9998-auth@test.com',
    roleType: 'admin',
    userType: 'admin',
    store: null,
    status: 'active',
    fullName: 'adminauth'
  })
  await db.user.create({
    id: 9997,
    userName: 'admin2auth',
    email: 'p14-9997-auth@test.com',
    roleType: 'admin',
    userType: 'admin',
    store: null,
    status: 'active',
    fullName: 'admin2auth'
  })
  await db.user.create({
    id: 9996,
    userName: 'userauth',
    email: 'p14-9996-auth@test.com',
    roleType: 'user',
    userType: 'user',
    store: null,
    status: 'active',
    fullName: 'userauth'
  })
})

afterAll(async () => {
  await db.user.destroy({ where: { id: [9999, 9998, 9997, 9996] }, force: true })
})

describe('Authorization middleware — role-based access', () => {
  describe('GET /invoice/setting', () => {
    test('super_admin can access any store setting', async () => {
      const res = await request(app)
        .get('/invoice/setting?store=1')
        .set('Authorization', `Bearer ${superAdminToken}`)

      expect(res.status).toBe(200)
    })

    test('admin can access own store setting', async () => {
      const res = await request(app)
        .get('/invoice/setting?store=1')
        .set('Authorization', `Bearer ${adminStore1Token}`)

      expect(res.status).toBe(200)
    })

    test('admin cannot access other store setting', async () => {
      const res = await request(app)
        .get('/invoice/setting?store=2')
        .set('Authorization', `Bearer ${adminStore1Token}`)

      expect(res.status).toBe(403)
    })

    test('user can access own store setting', async () => {
      const res = await request(app)
        .get('/invoice/setting?store=1')
        .set('Authorization', `Bearer ${userStore1Token}`)

      expect(res.status).toBe(200)
    })

    test('user cannot access other store setting', async () => {
      const res = await request(app)
        .get('/invoice/setting?store=2')
        .set('Authorization', `Bearer ${userStore1Token}`)

      expect(res.status).toBe(403)
    })
  })

  describe('PUT /invoice/setting', () => {
    test('super_admin can update any store setting', async () => {
      const res = await request(app)
        .put('/invoice/setting')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ store: 1, showStoreName: false })

      expect(res.status).toBe(200)
    })

    test('admin can update own store setting', async () => {
      const res = await request(app)
        .put('/invoice/setting')
        .set('Authorization', `Bearer ${adminStore1Token}`)
        .send({ store: 1, showStoreName: false })

      expect(res.status).toBe(200)
    })

    test('admin cannot update other store setting', async () => {
      const res = await request(app)
        .put('/invoice/setting')
        .set('Authorization', `Bearer ${adminStore1Token}`)
        .send({ store: 2, showStoreName: false })

      expect(res.status).toBe(403)
    })

    test('user cannot update own store setting (role not allowed)', async () => {
      const res = await request(app)
        .put('/invoice/setting')
        .set('Authorization', `Bearer ${userStore1Token}`)
        .send({ store: 1, showStoreName: false })

      expect(res.status).toBe(403)
    })
  })

  describe('POST /invoice/setting/reset', () => {
    test('super_admin can reset any store setting', async () => {
      const res = await request(app)
        .post('/invoice/setting/reset')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ store: 1 })

      expect(res.status).toBe(200)
    })

    test('admin can reset own store setting', async () => {
      const res = await request(app)
        .post('/invoice/setting/reset')
        .set('Authorization', `Bearer ${adminStore1Token}`)
        .send({ store: 1 })

      expect(res.status).toBe(200)
    })

    test('admin cannot reset other store setting', async () => {
      const res = await request(app)
        .post('/invoice/setting/reset')
        .set('Authorization', `Bearer ${adminStore1Token}`)
        .send({ store: 2 })

      expect(res.status).toBe(403)
    })

    test('user cannot reset own store setting (role not allowed)', async () => {
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
})

describe('Unauthenticated access', () => {
  test('GET /invoice/setting without token returns 401', async () => {
    const res = await request(app).get('/invoice/setting?store=1')
    expect(res.status).toBe(401)
  })

  test('PUT /invoice/setting without token returns 401', async () => {
    const res = await request(app)
      .put('/invoice/setting')
      .send({ store: 1, showStoreName: false })
    expect(res.status).toBe(401)
  })

  test('POST /invoice/setting/reset without token returns 401', async () => {
    const res = await request(app)
      .post('/invoice/setting/reset')
      .send({ store: 1 })
    expect(res.status).toBe(401)
  })
})