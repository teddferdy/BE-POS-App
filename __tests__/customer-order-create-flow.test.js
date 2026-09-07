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
let adminToken = null

// The cashier is the trusted paid-transition authority: only the
// authenticated order-status transition may turn a public QR order into a
// paid order (and with it run the exact-once stock/ledger/accounting
// mutations).
const markOrderPaid = (token, body) =>
  request(app).put('/order/update-status').set('Authorization', `Bearer ${token}`).send(body)

beforeAll(async () => {
  location = await db.location.create({ name: 'CUST_ORD_STORE', status: 'active' })
  adminToken = jwt.sign(
    { id: 9403, userName: 'cust_ord_admin', roleType: 'admin', store: location.id },
    JWT_SECRET
  )
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

describe('POST /order/customer-create — QR paid only via trusted cashier transition', () => {
  test('create records UNPAID; the cashier paid transition writes the ledger and deducts stock exactly once', async () => {
    const beforeStock = await db.product.findByPk(product.id)

    // 1) Public create: no paid state, no ledger, no stock mutation.
    const res = await request(app)
      .post('/order/customer-create')
      .send({
        store: location.id,
        paymentMethod: 'cash',
        customerName: 'QR Customer',
        items: [{ productId: product.id, productName: product.nameProduct, quantity: 2 }]
      })

    expect(res.status).toBe(201)
    expect(res.body.data.paymentStatus).toBe('unpaid')
    expect(res.body.data.status).toBe('pending')
    expect((await db.product.findByPk(product.id)).stock).toBe(beforeStock.stock)
    expect(await db.transaction.findAll({ where: { order: res.body.data.id } })).toHaveLength(0)

    // 2) Authorized cashier marks it paid: payment-ledger row and the stock
    //    deduction commit atomically with that transition.
    const paid = await markOrderPaid(adminToken, { id: res.body.data.id, status: 'paid' })

    expect(paid.status).toBe(200)

    const afterStock = await db.product.findByPk(product.id)
    expect(afterStock.stock).toBe(beforeStock.stock - 2)

    const ledgerRows = await db.transaction.findAll({
      where: { order: res.body.data.id }
    })
    expect(ledgerRows.length).toBe(1)
    expect(Number(ledgerRows[0].amount)).toBe(Number(res.body.data.totalPrice))
  })
})

describe('POST /order/customer-create — QR order unpaid & exactly-once', () => {
  test('orders are recorded unpaid with NO inventory/ledger mutation at creation', async () => {
    const beforeStock = (await db.product.findByPk(product.id)).stock

    const res = await request(app)
      .post('/order/customer-create')
      .send({
        store: location.id,
        customerName: 'QR Unpaid',
        items: [{ productId: product.id, productName: product.nameProduct, quantity: 2 }]
      })

    expect(res.status).toBe(201)
    expect(res.body.data.paymentStatus).toBe('unpaid')

    // Unpaid orders must not touch inventory during creation — the later
    // mark-paid transition (deductStockForPaidOrder) is what deducts.
    expect((await db.product.findByPk(product.id)).stock).toBe(beforeStock)
    const ledgerRows = await db.transaction.findAll({
      where: { order: res.body.data.id }
    })
    expect(ledgerRows.length).toBe(0)
  })

  test('retried submit with the same idempotencyKey: returns existing order; paid transition is exactly-once', async () => {
    const beforeStock = (await db.product.findByPk(product.id)).stock
    const body = {
      store: location.id,
      paymentMethod: 'cash',
      customerName: 'QR Idem',
      idempotencyKey: `qr-idem-${Date.now()}`,
      items: [{ productId: product.id, productName: product.nameProduct, quantity: 1 }]
    }

    const r1 = await request(app).post('/order/customer-create').send(body)
    expect(r1.status).toBe(201)
    expect(r1.body.data.paymentStatus).toBe('unpaid')
    expect((await db.product.findByPk(product.id)).stock).toBe(beforeStock)

    const r2 = await request(app).post('/order/customer-create').send(body)
    expect(r2.status).toBe(200)
    expect(r2.body.data.id).toBe(r1.body.data.id)

    // Only the one (idempotent) order exists, and the ledger/deduction are
    // still zero — the paid transition has not happened yet.
    expect((await db.product.findByPk(product.id)).stock).toBe(beforeStock)
    expect(await db.transaction.findAll({ where: { order: r1.body.data.id } })).toHaveLength(0)

    // Replaying the idempotent create after payment still returns the same
    // order, and the single trusted transition deducts exactly once.
    const paid = await markOrderPaid(adminToken, { id: r1.body.data.id, status: 'paid' })
    expect(paid.status).toBe(200)

    const r3 = await request(app).post('/order/customer-create').send(body)
    expect(r3.status).toBe(200)
    expect(r3.body.data.id).toBe(r1.body.data.id)

    expect((await db.product.findByPk(product.id)).stock).toBe(beforeStock - 1)
    const ledgerRows = await db.transaction.findAll({
      where: { order: r1.body.data.id }
    })
    expect(ledgerRows.length).toBe(1)
  })
})