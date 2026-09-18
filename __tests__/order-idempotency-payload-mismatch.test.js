process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// F-IDEM-1 regression: a same-key retry carrying a DIFFERENT payload must
// not silently replay the winner. Sales-return / split-bill / parked-cart
// already answer 409 on payload mismatch; order create paths replayed
// blindly. Persisted order_item rows are sufficient for comparison, so no
// schema change is required.

const unique = (prefix) =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

let store = null
let category = null
let productA = null
let productB = null
let token = null

function orderPayload(items, key) {
  return {
    store: store.id,
    items,
    paymentMethod: 'cash',
    cashierName: 'Idempotency Cashier',
    idempotencyKey: key
  }
}

beforeAll(async () => {
  store = await db.location.create({
    name: `IDEM_STORE_${Date.now()}`,
    status: 'active'
  })
  category = await db.category.create({ name: `IDEM_CAT_${Date.now()}` })
  productA = await db.product.create({
    nameProduct: `IDEM_A_${Date.now()}`,
    category: category.id,
    price: 10000,
    stock: 50
  })
  productB = await db.product.create({
    nameProduct: `IDEM_B_${Date.now()}`,
    category: category.id,
    price: 20000,
    stock: 50
  })
  await db.product_store_stock.create({
    product: productA.id,
    store: store.id,
    stock: 50
  })
  await db.product_store_stock.create({
    product: productB.id,
    store: store.id,
    stock: 50
  })
  token = jwt.sign(
    { id: 7201, userName: 'cashier_idem', roleType: 'kasir', store: store.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  const productIds = [productA?.id, productB?.id].filter(Boolean)
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: store?.id }, force: true })
  await db.best_selling.destroy({ where: { productId: productIds }, force: true })
  await db.stock_history.destroy({ where: { product: productIds }, force: true })
  await db.product_store_stock.destroy({ where: { product: productIds }, force: true })
  await db.product.destroy({ where: { id: productIds }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: store?.id }, force: true })
})

async function postOrder(body) {
  return request(app)
    .post('/order/create')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
}

describe('F-IDEM-1 order idempotency payload mismatch', () => {
  test('A — same key + same payload replays the original order', async () => {
    const key = unique('idemA')
    const body = orderPayload(
      [{ product: productA.id, quantity: 1, productName: 'A' }],
      key
    )
    const first = await postOrder(body)
    expect(first.status).toBe(201)

    const retry = await postOrder(body)
    expect(retry.status).toBe(200)
    expect(retry.body?.data?.id).toBe(first.body?.data?.id)
    expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1)
  })

  test('B — same key + different payload is rejected without a new order', async () => {
    const key = unique('idemB')
    const first = await postOrder(
      orderPayload([{ product: productA.id, quantity: 1, productName: 'A' }], key)
    )
    expect(first.status).toBe(201)
    const stockBefore = Number((await db.product.findByPk(productB.id)).stock)

    const retry = await postOrder(
      orderPayload([{ product: productB.id, quantity: 2, productName: 'B' }], key)
    )
    expect(retry.status).toBe(409)
    expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1)
    // The rejected retry must not have mutated anything.
    expect(Number((await db.product.findByPk(productB.id)).stock)).toBe(stockBefore)
  })

  test('C — concurrent same-key same-payload requests create exactly one order', async () => {
    const key = unique('idemC')
    const body = orderPayload(
      [{ product: productA.id, quantity: 1, productName: 'A' }],
      key
    )
    const [r1, r2] = await Promise.all([postOrder(body), postOrder(body)])
    expect([r1.status, r2.status].sort()).toEqual([200, 201])
    expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1)
  })

  test('D — different keys create independent orders', async () => {
    const r1 = await postOrder(
      orderPayload([{ product: productA.id, quantity: 1, productName: 'A' }], unique('idemD1'))
    )
    const r2 = await postOrder(
      orderPayload([{ product: productB.id, quantity: 1, productName: 'B' }], unique('idemD2'))
    )
    expect(r1.status).toBe(201)
    expect(r2.status).toBe(201)
    expect(r2.body?.data?.id).not.toBe(r1.body?.data?.id)
  })
})
