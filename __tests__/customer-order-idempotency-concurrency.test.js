process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// SEC-004 — regression coverage for the customer-path (POST /order/customer-create)
// idempotency race. The forensic audit (Phase 5.2) established that correctness is
// provided by the partial UNIQUE index on (store, idempotencyKey) plus the
// SequelizeUniqueConstraintError recovery in createCustomerOrder. These tests pin
// that invariant with genuinely concurrent requests (Promise.all → real supertest
// HTTP round-trips → real Postgres transactions), matching the existing
// concurrency-race-conditions pattern for the POS path.
//
// These tests are TEST-ONLY. They do not modify production code, models, or schema.

let store1 = null
let store2 = null
let category = null
let product = null
let table = null
let adminToken = null

// The cashier is the trusted paid-transition authority: only the authenticated
// order-status transition may turn a public QR order into a paid order (and with
// it run the exact-once stock/ledger mutations).
const markOrderPaid = (token, body) =>
  request(app).put('/order/update-status').set('Authorization', `Bearer ${token}`).send(body)

const makeCustomerCreate = (storeId, tableId, idempotencyKey) =>
  request(app).post('/order/customer-create').send({
    store: storeId,
    tableId,
    customerName: 'SEC004 Concurrent',
    idempotencyKey,
    items: [{ productId: product.id, productName: product.nameProduct, quantity: 1 }]
  })

const countOrders = (storeId, idempotencyKey) =>
  db.order.count({ where: { store: storeId, idempotencyKey } })

const countOrderItems = async (orderId) =>
  db.order_item.count({ where: { order: orderId } })

beforeAll(async () => {
  store1 = await db.location.create({ name: 'SEC004_STORE_1', status: 'active' })
  store2 = await db.location.create({ name: 'SEC004_STORE_2', status: 'active' })
  adminToken = jwt.sign(
    { id: 9405, userName: 'sec004_admin', roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  category = await db.category.create({ name: 'SEC004_CATEGORY' })
  product = await db.product.create({
    nameProduct: 'SEC004_PRODUCT',
    category: category.id,
    price: 12000,
    stock: 50,
    isAvailable: true
  })
  await db.product_store_stock.create({
    product: product.id,
    store: store1.id,
    stock: product.stock
  })
  await db.product_store_stock.create({
    product: product.id,
    store: store2.id,
    stock: product.stock
  })
  table = await db.table.create({ store: store1.id, name: 'SEC004_TABLE' })
})

afterAll(async () => {
  const stores = [store1?.id, store2?.id].filter(Boolean)
  const orders = await db.order.findAll({ where: { store: stores } })
  for (const o of orders) {
    await db.order_item.destroy({ where: { order: o.id }, force: true })
    await db.order_status.destroy({ where: { order: o.id }, force: true })
    await db.transaction.destroy({ where: { order: o.id }, force: true })
    await db.order.destroy({ where: { id: o.id }, force: true })
  }
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.stock_history.destroy({ where: { product: product?.id }, force: true })
  await db.best_selling.destroy({ where: { productId: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.table.destroy({ where: { id: table?.id }, force: true })
  await db.location.destroy({ where: { id: [store1?.id, store2?.id].filter(Boolean) }, force: true })
})

describe('SEC-004 — concurrent customer-create idempotency (POST /order/customer-create)', () => {
  test('two concurrent identical requests with the same (store, table, idempotencyKey) produce exactly one order', async () => {
    const idempotencyKey = `sec004-race-${Date.now()}`
    const req = () => makeCustomerCreate(store1.id, table.id, idempotencyKey)

    // Fired together, NOT awaited sequentially — both requests are in flight
    // at the same time, racing the idempotency check / unique index at once.
    const [resA, resB] = await Promise.all([req(), req()])

    // Exactly one fresh create (201) and one replay (200) — whichever Promise
    // resolved first. Normalize statuses before asserting.
    expect([resA.status, resB.status].sort()).toEqual([200, 201])

    // Both responses must reference the SAME order id.
    expect(resA.body.data.id).toBe(resB.body.data.id)

    // Both responses are the full order payload (replay re-fetches the winner).
    expect(resA.body.data.paymentStatus).toBe('unpaid')
    expect(resB.body.data.paymentStatus).toBe('unpaid')

    // The database must contain EXACTLY ONE order for this (store, key) pair —
    // this is the critical invariant, not just matching returned ids.
    const orderCount = await countOrders(store1.id, idempotencyKey)
    expect(orderCount).toBe(1)

    // Exactly one set of order items — the losing request must not create a
    // second line set.
    const winningOrder = await db.order.findOne({
      where: { store: store1.id, idempotencyKey }
    })
    expect(winningOrder).not.toBeNull()
    expect(await countOrderItems(winningOrder.id)).toBe(1)

    // QR orders are created UNPAID with no stock/ledger side effects at
    // creation time (AUD-1) — the request body carries a customerName, no
    // paymentMethod, so paymentStatus must be unpaid and no payment ledger row
    // may exist yet.
    expect(winningOrder.paymentStatus).toBe('unpaid')
    expect(
      await db.transaction.findAll({ where: { order: winningOrder.id } })
    ).toHaveLength(0)
    expect((await db.product.findByPk(product.id)).stock).toBe(50)

    // Optional exact-once paid-transition assertion: marking the single winning
    // order paid must deduct stock and write the ledger exactly once.
    const paid = await markOrderPaid(adminToken, { id: winningOrder.id, status: 'paid' })
    expect(paid.status).toBe(200)
    expect((await db.product.findByPk(product.id)).stock).toBe(49) // 50 - 1
    expect(
      await db.transaction.findAll({ where: { order: winningOrder.id } })
    ).toHaveLength(1)
  })
})

describe('SEC-004 — idempotency scoped per (store, idempotencyKey), not global', () => {
  test('the same idempotencyKey used in two different stores yields two independent orders', async () => {
    const idempotencyKey = `sec004-crossstore-${Date.now()}`

    const res1 = await makeCustomerCreate(store1.id, table.id, idempotencyKey)
    const res2 = await makeCustomerCreate(store2.id, undefined, idempotencyKey)

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)

    // Different stores → different orders, even with the identical key.
    expect(res1.body.data.id).not.toBe(res2.body.data.id)

    // Exactly one order exists in each store for that key (scoped uniqueness).
    expect(await countOrders(store1.id, idempotencyKey)).toBe(1)
    expect(await countOrders(store2.id, idempotencyKey)).toBe(1)

    // Each store's order references its own store, not the other's.
    expect(res1.body.data.store).toBe(store1.id)
    expect(res2.body.data.store).toBe(store2.id)
  })
})
