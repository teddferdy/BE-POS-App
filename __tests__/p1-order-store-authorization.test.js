// P1 Outlet Pricing Hardening: Fix A — Order Create Store Authorization
//
// Regression tests covering the cross-store authorization bypass in /order/create.
// The defect: legacy validateStoreAccess middleware may authorize query.store while
// createOrder controller uses body.store, allowing a request to pass auth for one
// store and operate on another.
//
// Canonical fix: createOrder must pin all operations to req.storeId (set by middleware
// based on the authorized store), rejecting any body.store mismatch before writes.

const request = require('supertest')
const app = require('../app')
const db = require('../db/models')
const { Order, OrderItem, StockMovement } = require('../db/models')

let storeA, storeB, userA, token

beforeAll(async () => {
  await db.sequelize.sync({ force: true })

  storeA = await db.location.create({ name: 'Store A', address: 'Addr A' })
  storeB = await db.location.create({ name: 'Store B', address: 'Addr B' })

  userA = await db.user.create({
    email: 'user@test.com',
    password: 'hashed',
    firstName: 'Test',
    store: storeA.id,
    roleType: 'cashier',
    status: 'active'
  })

  const token_ = require('jsonwebtoken').sign(
    { userId: userA.id, store: storeA.id, roleType: 'cashier' },
    process.env.JWT_SECRET || 'test-secret'
  )
  token = token_
})

afterAll(async () => {
  await db.sequelize.close()
})

describe('POST /order/create — store authorization hardening', () => {
  beforeEach(async () => {
    await OrderItem.destroy({ where: {} })
    await Order.destroy({ where: {} })
    await db.cashRegister.destroy({ where: {} })
    await db.product.destroy({ where: {} })
    await db.table.destroy({ where: {} })

    await db.cashRegister.create({
      name: 'Register A',
      store: storeA.id,
      status: 'open'
    })

    await db.product.create({
      id: 101,
      nameProduct: 'Coffee',
      price: 5000,
      store: storeA.id
    })

    await db.table.create({
      name: 'T1',
      store: storeA.id,
      status: 'available'
    })
  })

  test('authorized query store + foreign body store → rejected before any writes', async () => {
    const res = await request(app)
      .post('/order/create?store=' + storeA.id)
      .set('Authorization', `Bearer ${token}`)
      .send({
        store: storeB.id,
        items: [{ productId: 101, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/unauthorized|store/)

    const orderCount = await Order.count()
    expect(orderCount).toBe(0)
  })

  test('foreign query store + authorized body store → rejected unless explicitly valid', async () => {
    const res = await request(app)
      .post('/order/create?store=' + storeB.id)
      .set('Authorization', `Bearer ${token}`)
      .send({
        store: storeA.id,
        items: [{ productId: 101, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      })

    expect(res.status).toBeGreaterThanOrEqual(400)
    const orderCount = await Order.count()
    expect(orderCount).toBe(0)
  })

  test('both store identifiers match authorized store → allowed', async () => {
    const res = await request(app)
      .post('/order/create?store=' + storeA.id)
      .set('Authorization', `Bearer ${token}`)
      .send({
        store: storeA.id,
        items: [{ productId: 101, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      })

    expect(res.status).toBe(200)
    expect(res.body.data.order).toBeDefined()
    expect(res.body.data.order.store).toBe(storeA.id)
  })

  test('body-only store (no query param) → uses authorized store', async () => {
    const res = await request(app)
      .post('/order/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store: storeA.id,
        items: [{ productId: 101, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      })

    expect(res.status).toBe(200)
    expect(res.body.data.order.store).toBe(storeA.id)
  })

  test('query-only store (no body store) → uses authorized store', async () => {
    const res = await request(app)
      .post('/order/create?store=' + storeA.id)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: 101, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      })

    expect(res.status).toBe(200)
    expect(res.body.data.order.store).toBe(storeA.id)
  })

  test('rejected request → no order created, no items, no stock changes', async () => {
    await request(app)
      .post('/order/create?store=' + storeA.id)
      .set('Authorization', `Bearer ${token}`)
      .send({
        store: storeB.id,
        items: [{ productId: 101, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      })

    const orderCount = await Order.count()
    const itemCount = await OrderItem.count()
    const stockMoves = await StockMovement.count()

    expect(orderCount).toBe(0)
    expect(itemCount).toBe(0)
    expect(stockMoves).toBe(0)
  })
})
