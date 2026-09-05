process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const app = require('../api/index')
const db = require('../db/models')

let location = null
let category = null
let product = null

beforeAll(async () => {
  location = await db.location.create({ name: 'CUST_ORD_STORE', status: 'active' })
  category = await db.category.create({ name: 'CUST_ORD_CATEGORY' })
  product = await db.product.create({
    nameProduct: 'CUST_ORD_PRODUCT',
    category: category.id,
    price: 12000,
    stock: 15
  })
  await db.product_store_stock.create({
    product: product.id,
    store: location.id,
    stock: product.stock
  })
})

afterAll(async () => {
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: location.id }, force: true })
  await db.best_selling.destroy({ where: { productId: product?.id }, force: true })
  await db.stock_history.destroy({ where: { product: product?.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

describe('POST /order/customer-create — QR order paid immediately', () => {
  test('records the payment ledger row atomically with the order and stock deduction', async () => {
    const beforeStock = await db.product.findByPk(product.id)

    const res = await request(app)
      .post('/order/customer-create')
      .send({
        store: location.id,
        paymentMethod: 'cash',
        customerName: 'QR Customer',
        items: [{ productId: product.id, productName: product.nameProduct, quantity: 2 }]
      })

    expect(res.status).toBe(201)
    expect(res.body.data.paymentStatus).toBe('paid')

    const afterStock = await db.product.findByPk(product.id)
    expect(afterStock.stock).toBe(beforeStock.stock - 2)

    // The payment-ledger row must exist immediately — it's now written
    // inside the same transaction as the order/items/stock deduction,
    // not as a separate unprotected step afterward.
    const ledgerRows = await db.transaction.findAll({
      where: { order: res.body.data.id }
    })
    expect(ledgerRows.length).toBe(1)
    expect(Number(ledgerRows[0].amount)).toBe(Number(res.body.data.totalPrice))
  })
})
