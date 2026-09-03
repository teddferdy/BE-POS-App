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
  location = await db.location.create({ name: 'ORD_CANCEL_STORE', status: 'active' })
  category = await db.category.create({ name: 'ORD_CANCEL_CATEGORY' })
  product = await db.product.create({
    nameProduct: 'ORD_CANCEL_PRODUCT',
    category: category.id,
    price: 10000,
    stock: 20
  })
  cashierToken = jwt.sign(
    { id: 7101, userName: 'cashier_ord_cancel', roleType: 'kasir', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.order_status.destroy({ where: {}, force: true })
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: location.id }, force: true })
  await db.best_selling.destroy({ where: { productId: product?.id }, force: true })
  await db.stock_history.destroy({ where: { product: product?.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

describe('PUT /order/update-status — cancel restores stock (reverseOrderStock)', () => {
  test('cancelling a paid order restores the deducted stock', async () => {
    const createRes = await request(app)
      .post('/order/create')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        store: location.id,
        items: [{ product: product.id, quantity: 5 }],
        paymentMethod: 'cash',
        cashierName: 'Test Cashier'
      })
    expect(createRes.status).toBe(201)

    const afterCreate = await db.product.findByPk(product.id)
    expect(afterCreate.stock).toBe(15)

    const cancelRes = await request(app)
      .put('/order/update-status')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        id: createRes.body.data.id,
        status: 'cancelled',
        store: location.id
      })

    expect(cancelRes.status).toBe(200)

    const afterCancel = await db.product.findByPk(product.id)
    expect(afterCancel.stock).toBe(20)

    const order = await db.order.findByPk(createRes.body.data.id)
    expect(order.status).toBe('cancelled')
  })
})
