process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let location, category, product, token

const createOrderRequest = () =>
  request(app)
    .post('/order/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      store: location.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'F03Cashier'
    })

const setStatus = (id, status) =>
  request(app)
    .put('/order/update-status')
    .set('Authorization', `Bearer ${token}`)
    .send({ id, store: location.id, status, changedByName: 'F03-Test' })

describe('F-03 cancelled/refunded order must not be resurrected to paid', () => {
  beforeAll(async () => {
    location = await db.location.create({ name: 'F03_RACE_STORE', status: 'active' })
    category = await db.category.create({ name: 'F03_CATEGORY' })
    product = await db.product.create({
      nameProduct: 'F03_PRODUCT',
      category: category.id,
      price: 10000,
      stock: 10
    })
    // getEffectiveStock() prefers product_store_stock over product.stock once
    // a row exists — seed it to match, mirroring a store that's already selling.
    await db.product_store_stock.create({
      product: product.id,
      store: location.id,
      stock: product.stock
    })
    token = jwt.sign(
      { id: 9901, userName: 'f03_cashier', roleType: 'kasir', store: location.id },
      JWT_SECRET
    )
  })

  afterAll(async () => {
    await db.order_item.destroy({ where: {}, force: true })
    await db.transaction.destroy({ where: {}, force: true })
    await db.order_status.destroy({ where: {}, force: true })
    await db.accounting_outbox.destroy({ where: {}, force: true })
    await db.journal_entry_line.destroy({ where: {}, force: true })
    await db.journal_entry.destroy({ where: {}, force: true })
    await db.best_selling.destroy({ where: { productId: product.id }, force: true })
    await db.stock_history.destroy({ where: { product: product.id }, force: true })
    await db.product_store_stock.destroy({ where: { product: product.id }, force: true })
    await db.order.destroy({ where: { store: location.id }, force: true })
    await db.product.destroy({ where: { id: product.id }, force: true })
    await db.category.destroy({ where: { id: category.id }, force: true })
    await db.location.destroy({ where: { id: location.id }, force: true })
  })

  test('happy path works: order is created paid (stock 10->9) and can be cancelled back to refunded (9->10)', async () => {
    const created = await createOrderRequest()
    expect(created.status).toBe(201)
    const orderId = created.body.data.id

    let order = await db.order.findByPk(orderId)
    expect(order.status).toBe('paid')
    expect(order.paymentStatus).toBe('paid')
    expect(Number(order.subTotal)).toBe(10000)
    expect(Number(order.totalPrice)).toBeGreaterThanOrEqual(10000)

    const afterPaid = await db.product.findByPk(product.id)
    expect(Number(afterPaid.stock)).toBe(9)

    const cancelled = await setStatus(orderId, 'cancelled')
    expect(cancelled.status).toBe(200)

    order = await db.order.findByPk(orderId)
    expect(order.status).toBe('cancelled')
    expect(order.paymentStatus).toBe('refunded')

    const afterCancel = await db.product.findByPk(product.id)
    expect(Number(afterCancel.stock)).toBe(10)
  }, 60000)

  test('a cancelled/refunded order cannot be re-marked paid: 4xx, stock and ledger untouched, no new paid status row', async () => {
    const created = await createOrderRequest()
    expect(created.status).toBe(201)
    const orderId = created.body.data.id

    await setStatus(orderId, 'cancelled')
    expect((await db.order.findByPk(orderId)).paymentStatus).toBe('refunded')

    // Snapshot every financial/stock signal the resurrection would corrupt.
    const stockBefore = Number((await db.product.findByPk(product.id)).stock)
    const statusRowsBefore = await db.order_status.count({
      where: { order: orderId }
    })
    const txnRowsBefore = await db.transaction.count({ where: { order: orderId } })
    const journalRowsBefore = await db.journal_entry.count({
      where: { store: location.id, referenceId: orderId }
    })

    const resurrect = await setStatus(orderId, 'paid')

    // Vulnerable bug: this returned 200, re-deducted stock (10->9) and left
    // the order paid again on top of a refund.
    expect(resurrect.status).not.toBe(200)

    const order = await db.order.findByPk(orderId)
    expect(order.status).toBe('cancelled')
    expect(order.paymentStatus).toBe('refunded')

    const stockAfter = Number((await db.product.findByPk(product.id)).stock)
    expect(stockAfter).toBe(stockBefore)

    expect(await db.order_status.count({ where: { order: orderId } })).toBe(statusRowsBefore)
    expect(await db.transaction.count({ where: { order: orderId } })).toBe(txnRowsBefore)
    expect(await db.journal_entry.count({ where: { store: location.id, referenceId: orderId } })).toBe(journalRowsBefore)
  }, 60000)

  test('a cancelled-pending (never-paid) order also cannot be resurrected to paid', async () => {
    const created = await createOrderRequest()
    expect(created.status).toBe(201)
    const orderId = created.body.data.id

    const cancelled = await setStatus(orderId, 'cancelled')
    expect(cancelled.status).toBe(200)

    const stockBefore = Number((await db.product.findByPk(product.id)).stock)
    const resurrect = await setStatus(orderId, 'paid')

    expect(resurrect.status).not.toBe(200)
    expect((await db.order.findByPk(orderId)).status).toBe('cancelled')
    expect(Number((await db.product.findByPk(product.id)).stock)).toBe(stockBefore)
  }, 60000)
})