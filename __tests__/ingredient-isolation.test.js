process.env.NODE_ENV = 'development'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Users
const superAdminToken = jwt.sign(
  { id: 9999, userName: 'superadmin', roleType: 'super_admin' },
  JWT_SECRET
)

const adminStore1Token = jwt.sign(
  { id: 9998, userName: 'admin1', roleType: 'admin', store: 1 },
  JWT_SECRET
)

const adminStore2Token = jwt.sign(
  { id: 9997, userName: 'admin2', roleType: 'admin', store: 2 },
  JWT_SECRET
)

let ingStore1 = null
let ingStore2 = null

beforeAll(async () => {
  ingStore1 = await db.ingredient.create({
    store: 1,
    name: 'TEST_ISOLATION_STORE1',
    stock: 10,
    minStock: 2,
    unit: 'pcs',
    baseUnit: 'pcs',
    conversionFactor: 1,
    status: 'active'
  })

  ingStore2 = await db.ingredient.create({
    store: 2,
    name: 'TEST_ISOLATION_STORE2',
    stock: 20,
    minStock: 5,
    unit: 'pcs',
    baseUnit: 'pcs',
    conversionFactor: 1,
    status: 'active'
  })
})

afterAll(async () => {
  const ids = []
  if (ingStore1) ids.push(ingStore1.id)
  if (ingStore2) ids.push(ingStore2.id)
  if (ids.length > 0) {
    await db.ingredient.destroy({ where: { id: ids }, force: true })
  }
})

// ===================== GET ALL =====================
describe('GET /ingredient/get-all — data isolation', () => {
  test('super_admin sees ingredients from all stores', async () => {
    const res = await request(app)
      .get('/ingredient/get-all')
      .set('Authorization', `Bearer ${superAdminToken}`)

    expect(res.status).toBe(200)
    const names = res.body.data.map((i) => i.name)
    expect(names).toContain('TEST_ISOLATION_STORE1')
    expect(names).toContain('TEST_ISOLATION_STORE2')
  })

  test('admin store 1 only sees store 1 ingredients', async () => {
    const res = await request(app)
      .get('/ingredient/get-all')
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(200)
    const names = res.body.data.map((i) => i.name)
    expect(names).toContain('TEST_ISOLATION_STORE1')
    expect(names).not.toContain('TEST_ISOLATION_STORE2')
  })

  test('admin store 1 cannot access store 2 via ?store= param', async () => {
    const res = await request(app)
      .get('/ingredient/get-all?store=2')
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(403)
  })

  test('admin store 2 only sees store 2 ingredients', async () => {
    const res = await request(app)
      .get('/ingredient/get-all')
      .set('Authorization', `Bearer ${adminStore2Token}`)

    expect(res.status).toBe(200)
    const names = res.body.data.map((i) => i.name)
    expect(names).not.toContain('TEST_ISOLATION_STORE1')
    expect(names).toContain('TEST_ISOLATION_STORE2')
  })
})

// ===================== GET BY ID =====================
describe('GET /ingredient/get-by-id/:id — data isolation', () => {
  test('admin store 1 cannot get store 2 ingredient by id', async () => {
    const res = await request(app)
      .get(`/ingredient/get-by-id/${ingStore2.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
  })

  test('admin store 1 can get own ingredient by id', async () => {
    const res = await request(app)
      .get(`/ingredient/get-by-id/${ingStore1.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('TEST_ISOLATION_STORE1')
  })

  test('super_admin can get any store ingredient by id', async () => {
    const res = await request(app)
      .get(`/ingredient/get-by-id/${ingStore2.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('TEST_ISOLATION_STORE2')
  })
})

// ===================== UPDATE =====================
describe('PUT /ingredient/edit/:id — data isolation', () => {
  test('admin store 1 cannot update store 2 ingredient', async () => {
    const res = await request(app)
      .put(`/ingredient/edit/${ingStore2.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ name: 'TEST_HACKED' })

    expect(res.status).toBe(404)
  })

  test('admin store 1 can update own ingredient', async () => {
    const res = await request(app)
      .put(`/ingredient/edit/${ingStore1.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ name: 'TEST_ISOLATION_STORE1_UPDATED' })

    expect(res.status).toBe(200)

    await ingStore1.reload()
    expect(ingStore1.name).toBe('TEST_ISOLATION_STORE1_UPDATED')

    await ingStore1.update({ name: 'TEST_ISOLATION_STORE1' })
  })
})

// ===================== DELETE =====================
describe('DELETE /ingredient/delete/:id — data isolation', () => {
  test('admin store 1 cannot delete store 2 ingredient', async () => {
    const res = await request(app)
      .delete(`/ingredient/delete/${ingStore2.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(404)

    const stillExists = await db.ingredient.findByPk(ingStore2.id)
    expect(stillExists).not.toBeNull()
  })

  test('admin store 1 can delete own ingredient', async () => {
    const res = await request(app)
      .delete(`/ingredient/delete/${ingStore1.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)

    expect(res.status).toBe(200)

    const deleted = await db.ingredient.findByPk(ingStore1.id)
    expect(deleted).toBeNull()

    ingStore1 = await db.ingredient.create({
      store: 1,
      name: 'TEST_ISOLATION_STORE1',
      stock: 10,
      minStock: 2,
      unit: 'pcs',
      baseUnit: 'pcs',
      conversionFactor: 1,
      status: 'active'
    })
  })
})

// ===================== ADJUST STOCK =====================
describe('PUT /ingredient/adjust-stock/:id — data isolation', () => {
  test('admin store 1 cannot adjust stock of store 2 ingredient', async () => {
    const res = await request(app)
      .put(`/ingredient/adjust-stock/${ingStore2.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ quantity: 5, type: 'add' })

    expect(res.status).toBe(404)

    const unchanged = await db.ingredient.findByPk(ingStore2.id)
    expect(unchanged.stock).toBe(20)
  })

  test('admin store 1 can adjust stock of own ingredient', async () => {
    const res = await request(app)
      .put(`/ingredient/adjust-stock/${ingStore1.id}`)
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ quantity: 5, type: 'add' })

    expect(res.status).toBe(200)

    await ingStore1.reload()
    expect(ingStore1.stock).toBe(15)

    await ingStore1.update({ stock: 10 })
  })
})

// ===================== CREATE =====================
describe('POST /ingredient/add — data isolation', () => {
  test('admin store 1 cannot create ingredient for store 2 (middleware blocks)', async () => {
    const res = await request(app)
      .post('/ingredient/add')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ name: 'TEST_ISOLATION_HACK', store: '2', status: 'active' })

    expect(res.status).toBe(403)
  })

  test('admin store 1 can create ingredient for own store', async () => {
    const res = await request(app)
      .post('/ingredient/add')
      .set('Authorization', `Bearer ${adminStore1Token}`)
      .send({ name: 'TEST_ISOLATION_CREATE', status: 'active' })

    expect(res.status).toBe(201)
    expect(res.body.data.store).toBe(1)

    await db.ingredient.destroy({
      where: { id: res.body.data.id },
      force: true
    })
  })

  test('super_admin can create ingredient for any store', async () => {
    const res = await request(app)
      .post('/ingredient/add')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'TEST_ISOLATION_SUPER_CREATE', store: '2', status: 'active' })

    expect(res.status).toBe(201)
    expect(res.body.data.store).toBe(2)

    await db.ingredient.destroy({
      where: { id: res.body.data.id },
      force: true
    })
  })
})

// ===================== UNAUTHENTICATED =====================
describe('Unauthenticated access', () => {
  test('returns 401 without token', async () => {
    const res = await request(app).get('/ingredient/get-all')
    expect(res.status).toBe(401)
  })
})
