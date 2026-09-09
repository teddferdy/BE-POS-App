process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 2 HIGH-4 regression: stockHistory.getByProduct returned all-store
// stock movements for a product because the WHERE clause only filtered by
// productId without checking stock_history.store.
// With the fix, non-super-admin receives only own-store stock movements.

let store1 = null
let store2 = null
let category = null
let product = null
let admin1Token = null
let admin2Token = null
let superToken = null
let hist1 = null
let hist2 = null
let histGlobal = null

beforeAll(async () => {
  store1 = await db.location.create({ name: 'HIGH4_STORE_A', status: 'active' })
  store2 = await db.location.create({ name: 'HIGH4_STORE_B', status: 'active' })
  category = await db.category.create({ name: 'HIGH4_CAT', status: 'active' })
  product = await db.product.create({
    nameProduct: 'HIGH4_SHARED_PRODUCT',
    category: category.id,
    price: 1000
  })

  const suffix = Date.now()
  const user1 = await db.user.create({
    id: 9401,
    userName: `high4_admin_a_${suffix}`,
    roleType: 'admin',
    store: store1.id,
    password: 'x'
  })
  const user2 = await db.user.create({
    id: 9402,
    userName: `high4_admin_b_${suffix}`,
    roleType: 'admin',
    store: store2.id,
    password: 'x'
  })

  admin1Token = jwt.sign(
    { id: user1.id, userName: user1.userName, roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  admin2Token = jwt.sign(
    { id: user2.id, userName: user2.userName, roleType: 'admin', store: store2.id },
    JWT_SECRET
  )
  superToken = jwt.sign(
    { id: 9400, userName: `high4_super_${suffix}`, roleType: 'super_admin' },
    JWT_SECRET
  )

  // Create stock_history entries for product in store1, store2, and null (unassigned)
  hist1 = await db.stock_history.create({
    product: product.id,
    store: store1.id,
    referenceType: 'adjustment',
    quantityBefore: 0,
    quantityChange: 10,
    quantityAfter: 10,
    unit: 'pcs',
    notes: 'Store 1 initial'
  })
  hist2 = await db.stock_history.create({
    product: product.id,
    store: store2.id,
    referenceType: 'adjustment',
    quantityBefore: 0,
    quantityChange: 20,
    quantityAfter: 20,
    unit: 'pcs',
    notes: 'Store 2 secret stock'
  })
  histGlobal = await db.stock_history.create({
    product: product.id,
    store: null,
    referenceType: 'adjustment',
    quantityBefore: 0,
    quantityChange: 5,
    quantityAfter: 5,
    unit: 'pcs',
    notes: 'Unassigned global stock'
  })
})

afterAll(async () => {
  await db.stock_history.destroy({
    where: { product: product?.id },
    force: true
  })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.user.destroy({ where: { id: [9401, 9402] }, force: true })
  await db.location.destroy({
    where: { id: [store1?.id, store2?.id].filter(Boolean) },
    force: true
  })
})

describe('HIGH-4 stockHistory tenant scoping', () => {
  test('store1 admin getByProduct returns ONLY store1 movements', async () => {
    const res = await request(app)
      .get(`/stock-history/get-by-product/${product.id}`)
      .set('Authorization', `Bearer ${admin1Token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const ids = res.body.data.map((h) => h.id)
    expect(ids).toContain(hist1.id)
    expect(ids).not.toContain(hist2.id)
    expect(ids).not.toContain(histGlobal.id)
  })

  test('store2 admin getByProduct returns ONLY store2 movements', async () => {
    const res = await request(app)
      .get(`/stock-history/get-by-product/${product.id}`)
      .set('Authorization', `Bearer ${admin2Token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const ids = res.body.data.map((h) => h.id)
    expect(ids).toContain(hist2.id)
    expect(ids).not.toContain(hist1.id)
    expect(ids).not.toContain(histGlobal.id)
  })

  test('super_admin getByProduct returns movements from all stores', async () => {
    const res = await request(app)
      .get(`/stock-history/get-by-product/${product.id}`)
      .set('Authorization', `Bearer ${superToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const ids = res.body.data.map((h) => h.id)
    expect(ids).toContain(hist1.id)
    expect(ids).toContain(hist2.id)
    expect(ids).toContain(histGlobal.id)
  })

  test('store1 admin getAll stock history is scoped to store1', async () => {
    const res = await request(app)
      .get('/stock-history/get-all')
      .query({ product: product.id })
      .set('Authorization', `Bearer ${admin1Token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const ids = res.body.data.map((h) => h.id)
    expect(ids).toContain(hist1.id)
    expect(ids).not.toContain(hist2.id)
  })

  test('store1 admin getAll cannot override store via query param', async () => {
    const res = await request(app)
      .get('/stock-history/get-all')
      .query({ store: store2.id, product: product.id })
      .set('Authorization', `Bearer ${admin1Token}`)

    // validateStoreAccess or controller will block or scope to store1
    if (res.status === 200) {
      const ids = res.body.data.map((h) => h.id)
      expect(ids).not.toContain(hist2.id)
    } else {
      expect(res.status).toBe(403)
    }
  })
})
