process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 31 Batch 2 (B-3): invalid itemStatus must be rejected at the API
// validation boundary (400) instead of reaching PostgreSQL and surfacing
// as a 500 enum error. Valid lifecycle values must keep working.
let store = null
let category = null
let product = null
let order = null
let item = null
let token = null

beforeAll(async () => {
  store = await db.location.create({ name: 'ITEMSTATUS_STORE', status: 'active' })
  category = await db.category.create({ name: 'ITEMSTATUS_CAT', status: 'active' })
  product = await db.product.create({
    nameProduct: 'ITEMSTATUS_PRODUCT',
    category: category.id,
    price: 5000
  })
  token = jwt.sign(
    { id: 7401, userName: 'itemstatus_admin', roleType: 'admin', store: store.id },
    JWT_SECRET
  )
  order = await db.order.create({
    orderNumber: `ITEMSTATUS-${Date.now()}`,
    store: store.id,
    status: 'pending',
    paymentStatus: 'paid',
    source: 'pos'
  })
  item = await db.order_item.create({
    order: order.id,
    product: product.id,
    quantity: 1,
    price: 5000,
    status: 'pending'
  })
})

afterAll(async () => {
  await db.order_item.destroy({ where: { id: item?.id }, force: true })
  await db.order.destroy({ where: { id: order?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: store?.id }, force: true })
})

async function setItemStatus(itemStatus) {
  return request(app)
    .put('/order/update-item-status')
    .set('Authorization', `Bearer ${token}`)
    .send({ id: order.id, itemId: item.id, itemStatus })
}

describe('PUT /order/update-item-status — request-boundary validation', () => {
  test.each(['pending', 'preparing', 'ready', 'served'])(
    'valid itemStatus %s succeeds',
    async (valid) => {
      await db.order_item.update({ status: 'pending' }, { where: { id: item.id } })
      const res = await setItemStatus(valid)
      expect(res.status).toBe(200)
      const row = await db.order_item.findByPk(item.id)
      expect(row.status).toBe(valid)
    }
  )

  test('invalid string itemStatus is rejected with 400, never 500', async () => {
    const res = await setItemStatus('cooking')
    expect(res.status).toBe(400)
    const row = await db.order_item.findByPk(item.id)
    expect(['pending', 'preparing', 'ready', 'served']).toContain(row.status)
  })

  test('non-string itemStatus is rejected with 400', async () => {
    const res = await setItemStatus(123)
    expect(res.status).toBe(400)
  })

  test('null itemStatus is rejected with 400', async () => {
    const res = await request(app)
      .put('/order/update-item-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: order.id, itemId: item.id, itemStatus: null })
    expect(res.status).toBe(400)
  })

  test('missing itemStatus is rejected with 400', async () => {
    const res = await request(app)
      .put('/order/update-item-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: order.id, itemId: item.id })
    expect(res.status).toBe(400)
  })
})
