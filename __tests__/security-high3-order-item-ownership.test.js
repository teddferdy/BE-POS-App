process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 2 HIGH-3 regression: updateOrderItemStatus had zero tenant checks.
// An attacker from Store 1 could supply any order ID and order item ID,
// mutating order items belonging to Store 2 and cascading status changes
// onto Store 2's parent order.
// With the fix, the parent order must belong to the caller's store.

let store1 = null
let store2 = null
let order1 = null
let order2 = null
let item1 = null
let item2 = null
let category = null
let product = null
let admin1Token = null
let admin2Token = null
let superToken = null

beforeAll(async () => {
  store1 = await db.location.create({ name: 'HIGH3_STORE_A', status: 'active' })
  store2 = await db.location.create({ name: 'HIGH3_STORE_B', status: 'active' })
  category = await db.category.create({ name: 'HIGH3_CAT', status: 'active' })
  product = await db.product.create({
    nameProduct: 'HIGH3_Product',
    category: category.id,
    price: 1000
  })

  admin1Token = jwt.sign(
    { id: 9301, userName: 'high3_admin_a', roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  admin2Token = jwt.sign(
    { id: 9302, userName: 'high3_admin_b', roleType: 'admin', store: store2.id },
    JWT_SECRET
  )
  superToken = jwt.sign(
    { id: 9300, userName: 'high3_super', roleType: 'super_admin' },
    JWT_SECRET
  )

  order1 = await db.order.create({
    orderNumber: `HIGH3-${Date.now()}-A`,
    store: store1.id,
    status: 'pending',
    paymentStatus: 'paid',
    source: 'pos'
  })
  order2 = await db.order.create({
    orderNumber: `HIGH3-${Date.now()}-B`,
    store: store2.id,
    status: 'pending',
    paymentStatus: 'paid',
    source: 'pos'
  })
  item1 = await db.order_item.create({
    order: order1.id,
    product: product.id,
    quantity: 1,
    price: 1000,
    status: 'pending'
  })
  item2 = await db.order_item.create({
    order: order2.id,
    product: product.id,
    quantity: 1,
    price: 1000,
    status: 'pending'
  })
})

afterAll(async () => {
  await db.order_item.destroy({
    where: { id: [item1?.id, item2?.id].filter(Boolean) },
    force: true
  })
  await db.order.destroy({
    where: { id: [order1?.id, order2?.id].filter(Boolean) },
    force: true
  })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({
    where: { id: [store1?.id, store2?.id].filter(Boolean) },
    force: true
  })
})

describe('HIGH-3 updateOrderItemStatus parent order ownership', () => {
  test('store1 admin CAN update own store order item status', async () => {
    const res = await request(app)
      .put('/order/update-item-status')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({
        id: order1.id,
        itemId: item1.id,
        itemStatus: 'preparing'
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Item status updated')

    const updated = await db.order_item.findByPk(item1.id)
    expect(updated.status).toBe('preparing')
  })

  test('store1 admin CANNOT update store2 order item status (foreign order IDOR rejected)', async () => {
    const res = await request(app)
      .put('/order/update-item-status')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({
        id: order2.id,
        itemId: item2.id,
        itemStatus: 'served'
      })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/order not found/i)

    // Verify no mutation occurred
    const unchanged = await db.order_item.findByPk(item2.id)
    expect(unchanged.status).toBe('pending')
  })

  test('mismatched order ID and item ID is rejected', async () => {
    const res = await request(app)
      .put('/order/update-item-status')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({
        id: order1.id,
        itemId: item2.id, // item2 belongs to order2
        itemStatus: 'served'
      })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/item not found/i)

    const unchanged = await db.order_item.findByPk(item2.id)
    expect(unchanged.status).toBe('pending')
  })

  test('nonexistent order ID is rejected with 404', async () => {
    const res = await request(app)
      .put('/order/update-item-status')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({
        id: 999999,
        itemId: item1.id,
        itemStatus: 'served'
      })

    expect(res.status).toBe(404)
  })

  test('super_admin CAN update any store order item status', async () => {
    const res = await request(app)
      .put('/order/update-item-status')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        id: order2.id,
        itemId: item2.id,
        itemStatus: 'preparing'
      })

    expect(res.status).toBe(200)
    const updated = await db.order_item.findByPk(item2.id)
    expect(updated.status).toBe('preparing')
  })
})
