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
let orderCounter = 0

const makeUnpaidOrder = async ({ qty = 5, totalPrice = 50000 } = {}) => {
  orderCounter += 1
  const order = await db.order.create({
    orderNumber: `SPL-TEST-${Date.now()}-${orderCounter}`,
    store: location.id,
    status: 'pending',
    paymentStatus: 'unpaid',
    subTotal: totalPrice,
    totalQuantity: qty,
    totalPrice,
    source: 'qr'
  })
  await db.order_item.create({
    order: order.id,
    product: product.id,
    productName: product.nameProduct,
    quantity: qty,
    price: 10000,
    totalPrice: qty * 10000
  })
  return order
}

beforeAll(async () => {
  location = await db.location.create({ name: 'SPL_FLOW_STORE', status: 'active' })
  category = await db.category.create({ name: 'SPL_FLOW_CATEGORY' })
  product = await db.product.create({
    nameProduct: 'SPL_FLOW_PRODUCT',
    category: category.id,
    price: 10000,
    stock: 100
  })
  await db.product_store_stock.create({
    product: product.id,
    store: location.id,
    stock: product.stock
  })
  adminToken = jwt.sign(
    { id: 7301, userName: 'admin_spl_flow', roleType: 'admin', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.split_bill.destroy({ where: {}, force: true })
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

describe('Split bill — transactions, ledger, and stock deduction on completion', () => {
  test('paying every split deducts stock exactly once and posts to the payment ledger', async () => {
    const order = await makeUnpaidOrder({ qty: 5 })
    const beforeStock = await db.product.findByPk(product.id)

    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, items: [{ amount: 25000 }, { amount: 25000 }] })
    expect(createRes.status).toBe(201)
    const [splitA, splitB] = createRes.body.data

    const payA = await request(app)
      .put(`/split-bill/pay/${splitA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentMethod: 'cash' })
    expect(payA.status).toBe(200)
    expect(payA.body.data.orderComplete).toBe(false)

    // Not complete yet — stock must still be untouched.
    const midStock = await db.product.findByPk(product.id)
    expect(midStock.stock).toBe(beforeStock.stock)

    const payB = await request(app)
      .put(`/split-bill/pay/${splitB.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentMethod: 'qris' })
    expect(payB.status).toBe(200)
    expect(payB.body.data.orderComplete).toBe(true)

    const afterStock = await db.product.findByPk(product.id)
    expect(afterStock.stock).toBe(beforeStock.stock - 5)

    const finalOrder = await db.order.findByPk(order.id)
    expect(finalOrder.status).toBe('paid')
    expect(finalOrder.paymentStatus).toBe('paid')

    const ledgerRows = await db.transaction.findAll({ where: { order: order.id } })
    expect(ledgerRows.length).toBe(2)
    expect(ledgerRows.reduce((sum, t) => sum + Number(t.amount), 0)).toBe(50000)
  })

  test('two splits of the same order paid at the same instant: order still completes exactly once, stock deducted exactly once', async () => {
    const order = await makeUnpaidOrder({ qty: 4 })
    const beforeStock = await db.product.findByPk(product.id)

    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, items: [{ amount: 20000 }, { amount: 20000 }] })
    const [splitA, splitB] = createRes.body.data

    const [resA, resB] = await Promise.all([
      request(app)
        .put(`/split-bill/pay/${splitA.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentMethod: 'cash' }),
      request(app)
        .put(`/split-bill/pay/${splitB.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentMethod: 'cash' })
    ])

    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
    // Exactly one of the two must have observed the order-completing state.
    expect([resA.body.data.orderComplete, resB.body.data.orderComplete]).toContain(true)

    const afterStock = await db.product.findByPk(product.id)
    // Must be deducted exactly once (4), never lost (0) or doubled (8).
    expect(afterStock.stock).toBe(beforeStock.stock - 4)

    const finalOrder = await db.order.findByPk(order.id)
    expect(finalOrder.paymentStatus).toBe('paid')

    const ledgerRows = await db.transaction.findAll({ where: { order: order.id } })
    expect(ledgerRows.length).toBe(2)
  })

  test('paying the same split twice concurrently: exactly one succeeds', async () => {
    const order = await makeUnpaidOrder({ qty: 2 })
    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, items: [{ amount: 20000 }] })
    const [split] = createRes.body.data

    const [r1, r2] = await Promise.all([
      request(app)
        .put(`/split-bill/pay/${split.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentMethod: 'cash' }),
      request(app)
        .put(`/split-bill/pay/${split.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentMethod: 'cash' })
    ])

    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual([200, 400])

    const ledgerRows = await db.transaction.findAll({ where: { order: order.id } })
    expect(ledgerRows.length).toBe(1)
  })

  test('cancelling a paid split is refused', async () => {
    const order = await makeUnpaidOrder({ qty: 1 })
    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, items: [{ amount: 10000 }] })
    const [split] = createRes.body.data

    await request(app)
      .put(`/split-bill/pay/${split.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentMethod: 'cash' })

    const cancelRes = await request(app)
      .delete(`/split-bill/cancel/${split.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(cancelRes.status).toBe(400)

    const stillThere = await db.split_bill.findByPk(split.id)
    expect(stillThere).not.toBeNull()
    expect(stillThere.status).toBe('paid')
  })

  test('cancelling a pending split still works', async () => {
    const order = await makeUnpaidOrder({ qty: 1 })
    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, items: [{ amount: 10000 }] })
    const [split] = createRes.body.data

    const cancelRes = await request(app)
      .delete(`/split-bill/cancel/${split.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(cancelRes.status).toBe(200)

    const gone = await db.split_bill.findByPk(split.id)
    expect(gone).toBeNull()
  })

  test('two concurrent create() calls for the same order: only one set of splits survives', async () => {
    const order = await makeUnpaidOrder({ qty: 1 })

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/split-bill/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order: order.id, items: [{ amount: 5000 }, { amount: 5000 }] }),
      request(app)
        .post('/split-bill/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order: order.id, items: [{ amount: 10000 }] })
    ])

    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual([201, 400])

    const allSplits = await db.split_bill.findAll({ where: { order: order.id } })
    // Only the winning create()'s items, never both sets.
    expect(allSplits.length).toBeLessThanOrEqual(2)
  })

  test('merge combines two pending splits atomically', async () => {
    const order = await makeUnpaidOrder({ qty: 1 })
    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, items: [{ amount: 10000 }, { amount: 15000 }] })
    const [splitA, splitB] = createRes.body.data

    const mergeRes = await request(app)
      .post('/split-bill/merge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, splitIds: [splitA.id, splitB.id] })

    expect(mergeRes.status).toBe(201)
    expect(mergeRes.body.data.amount).toBe(25000)

    const remaining = await db.split_bill.findAll({ where: { order: order.id } })
    expect(remaining.length).toBe(1)
    expect(remaining[0].amount).toBe(25000)
  })

  test('cancelling the order racing the final split payment: stock never ends up wrong regardless of ordering', async () => {
    // Cross-endpoint race: order-cancel (updateOrderStatus) vs the last
    // split payment's order-completion step (splitBill.pay). Both lock
    // the same order row, so exactly one interleaving happens:
    //  - cancel first: order cancelled while still unpaid (stock was
    //    never deducted for this order yet) — pay's completion guard
    //    must see the cancelled order and skip stock deduction/revival.
    //  - pay first: the order legitimately completes to paid (stock
    //    deducted), then cancel runs on a now-paid order exactly like an
    //    ordinary post-payment cancellation — reversing that same stock.
    // Either way, stock must land back at the pre-race baseline; it must
    // never be inflated (deducted-without-payment or revived-and-
    // re-deducted) or left permanently deducted with no reversal.
    const order = await makeUnpaidOrder({ qty: 5 })
    const baseline = await db.product.findByPk(product.id)

    const createRes = await request(app)
      .post('/split-bill/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ order: order.id, items: [{ amount: 25000 }, { amount: 25000 }] })
    const [splitA, splitB] = createRes.body.data

    const firstPay = await request(app)
      .put(`/split-bill/pay/${splitA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentMethod: 'cash' })
    expect(firstPay.status).toBe(200)
    expect(firstPay.body.data.orderComplete).toBe(false)

    const [cancelRes, finalPayRes] = await Promise.all([
      request(app)
        .put('/order/update-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: order.id, status: 'cancelled', store: location.id }),
      request(app)
        .put(`/split-bill/pay/${splitB.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentMethod: 'cash' })
    ])

    expect(cancelRes.status).toBe(200)
    expect(finalPayRes.status).toBe(200)

    const finalOrder = await db.order.findByPk(order.id)
    const finalStock = await db.product.findByPk(product.id)

    expect(finalOrder.status).toBe('cancelled')
    expect(finalStock.stock).toBe(baseline.stock)

    if (finalPayRes.body.data.orderComplete) {
      // Pay won the order-completion race: it deducted stock and marked
      // the order paid, then cancel reversed that same deduction.
      expect(finalOrder.paymentStatus).toBe('refunded')
    } else {
      // Cancel won: pay's completion step correctly saw the cancelled
      // order and never deducted anything to begin with.
      expect(finalOrder.paymentStatus).toBe('unpaid')
    }
  })
})
