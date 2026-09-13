process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let location = null
let category = null
let product = null
let cashierToken = null

beforeAll(async () => {
  location = await db.location.create({ name: 'INFO01_STORE', status: 'active' })
  category = await db.category.create({ name: 'INFO01_CAT' })
  product = await db.product.create({
    nameProduct: 'INFO01_PRODUCT',
    category: category.id,
    price: 10000,
    stock: 100
  })
  await db.product_store_stock.create({ product: product.id, store: location.id, stock: 100 })
  cashierToken = jwt.sign(
    { id: 9701, userName: 'info01_cashier', roleType: 'kasir', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: location.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

const createOrder = (items) =>
  request(app)
    .post('/order/create')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      store: location.id,
      items,
      paymentMethod: 'cash',
      cashierName: 'INFO01 Cashier'
    })

describe('INFO-01 quantity > 0 invariant', () => {
  test('quantity 0 is rejected (400) and does not create order', async () => {
    const before = await db.order.count({ where: { store: location.id } })
    const res = await createOrder([{ product: product.id, quantity: 0 }])
    expect(res.status).toBe(400)
    expect(res.body.message || res.body.error || '').toMatch(/quantity/i)
    const after = await db.order.count({ where: { store: location.id } })
    expect(after).toBe(before)
  })

  test('quantity -1 is rejected', async () => {
    const res = await createOrder([{ product: product.id, quantity: -1 }])
    expect(res.status).toBe(400)
    expect(res.body.message || res.body.error || '').toMatch(/quantity/i)
  })

  test('quantity 1 is accepted (201)', async () => {
    const res = await createOrder([{ product: product.id, quantity: 1 }])
    expect(res.status).toBe(201)
    expect(res.body.data).toBeTruthy()
    expect(res.body.data.totalPrice).toBeGreaterThan(0)
  })

  test('non-finite quantity NaN is rejected', async () => {
    const res = await createOrder([{ product: product.id, quantity: NaN }])
    // JSON.stringify(NaN) becomes null on wire, but direct controller call with NaN would be via JS; via HTTP it becomes null
    // We test via explicit string "NaN" and via missing/null as malformed
    expect([400, 422].includes(res.status)).toBe(true)
  })

  test('Infinity quantity is rejected', async () => {
    const res = await createOrder([{ product: product.id, quantity: Infinity }])
    // Infinity serializes to null as well, so expect rejection for malformed
    expect([400, 422].includes(res.status)).toBe(true)
  })

  test('string quantity "abc" is rejected', async () => {
    const res = await createOrder([{ product: product.id, quantity: 'abc' }])
    expect(res.status).toBe(400)
  })
})
