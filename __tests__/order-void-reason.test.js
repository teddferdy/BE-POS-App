process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const { Op } = require('sequelize')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 31 Batch 1 — paid-order cancel/void requires a meaningful reason,
// recorded in the existing VOID audit trail. Kasir permission unchanged.
//
// NOTE: each paid order uses a FRESH product because POS creation writes a
// store-level stock row on first sale (pre-existing behavior); reusing one
// product across tests would couple them through store stock.
let location = null
let category = null
let kasirToken = null
let adminToken = null

const KASIR_ID = 7201
const ADMIN_ID = 7202
const createdProductIds = []

beforeAll(async () => {
  location = await db.location.create({ name: 'VOID_REASON_STORE', status: 'active' })
  category = await db.category.create({ name: 'VOID_REASON_CATEGORY' })
  kasirToken = jwt.sign(
    { id: KASIR_ID, userName: 'kasir_void_reason', roleType: 'kasir', store: location.id },
    JWT_SECRET
  )
  adminToken = jwt.sign(
    { id: ADMIN_ID, userName: 'admin_void_reason', roleType: 'admin', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.auditLog.destroy({ where: { store: location.id }, force: true, __auditMaintenance: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: location.id }, force: true })
  for (const pid of createdProductIds) {
    await db.best_selling.destroy({ where: { productId: pid }, force: true })
    await db.stock_history.destroy({ where: { product: pid }, force: true })
    await db.product_store_stock.destroy({ where: { product: pid }, force: true })
    await db.product.destroy({ where: { id: pid }, force: true })
  }
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

async function makeProduct(stock = 50) {
  const p = await db.product.create({
    nameProduct: `VOIDRSN_PROD_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    category: category.id,
    price: 10000,
    stock
  })
  createdProductIds.push(p.id)
  return p
}

async function createPaidOrder(token, qty = 2) {
  const prod = await makeProduct(50)
  const res = await request(app)
    .post('/order/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      store: location.id,
      items: [{ product: prod.id, quantity: qty }],
      paymentMethod: 'cash',
      cashierName: 'Void Reason Cashier'
    })
  expect(res.status).toBe(201)
  return { order: res.body.data, prod }
}

async function cancelOrder(token, id, body = {}) {
  return request(app)
    .put('/order/update-status')
    .set('Authorization', `Bearer ${token}`)
    .send({ id, status: 'cancelled', store: location.id, ...body })
}

async function refundTxns(orderId) {
  return db.transaction.findAll({
    where: { order: orderId, amount: { [Op.lt]: 0 } }
  })
}

async function voidAudits(orderId) {
  return db.auditLog.findAll({
    where: { entity: 'order', entityId: orderId, action: 'void' },
    order: [['id', 'ASC']]
  })
}

describe('paid-order cancel/void requires a reason', () => {
  test('1. paid cancel WITHOUT reason is rejected', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const res = await cancelOrder(kasirToken, order.id)
    expect([400, 422]).toContain(res.status)
    const still = await db.order.findByPk(order.id)
    expect(still.status).toBe('paid')
  })

  test('2. paid cancel with empty reason is rejected', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const res = await cancelOrder(kasirToken, order.id, { reason: '' })
    expect([400, 422]).toContain(res.status)
    const still = await db.order.findByPk(order.id)
    expect(still.status).toBe('paid')
  })

  test('3. paid cancel with whitespace-only reason is rejected', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const res = await cancelOrder(kasirToken, order.id, { reason: '   ' })
    expect([400, 422]).toContain(res.status)
    const still = await db.order.findByPk(order.id)
    expect(still.status).toBe('paid')
  })

  test('4+5. paid cancel with valid reason succeeds and kasir stays authorized', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const res = await cancelOrder(kasirToken, order.id, {
      reason: 'Customer changed mind'
    })
    expect(res.status).toBe(200)
    const cancelled = await db.order.findByPk(order.id)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.paymentStatus).toBe('refunded')
  })

  test('6. admin with valid reason succeeds', async () => {
    const { order } = await createPaidOrder(adminToken)
    const res = await cancelOrder(adminToken, order.id, {
      reason: 'Duplicate order entered twice'
    })
    expect(res.status).toBe(200)
    const cancelled = await db.order.findByPk(order.id)
    expect(cancelled.status).toBe('cancelled')
  })

  test('7. refund transaction still created exactly as before', async () => {
    const { order } = await createPaidOrder(kasirToken, 3)
    const full = await db.order.findByPk(order.id)
    const res = await cancelOrder(kasirToken, order.id, { reason: 'Out of stock item' })
    expect(res.status).toBe(200)
    const refunds = await refundTxns(order.id)
    expect(refunds).toHaveLength(1)
    expect(Number(refunds[0].amount)).toBe(-Math.abs(Number(full.totalPrice)))
  })

  test('8. stock reversal still occurs exactly as before', async () => {
    const { order, prod } = await createPaidOrder(kasirToken, 4)
    const before = 50
    const mid = Number((await db.product.findByPk(prod.id)).stock)
    expect(mid).toBe(before - 4)
    const res = await cancelOrder(kasirToken, order.id, { reason: 'Kitchen closed early' })
    expect(res.status).toBe(200)
    const after = Number((await db.product.findByPk(prod.id)).stock)
    expect(after).toBe(before)
  })

  test('9+10. audit record contains reason and identifies actor/order/store/action', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const reason = 'Customer paid wrong amount, re-ring'
    const res = await cancelOrder(kasirToken, order.id, { reason })
    expect(res.status).toBe(200)
    const audits = await voidAudits(order.id)
    expect(audits.length).toBeGreaterThanOrEqual(1)
    const audit = audits[audits.length - 1]
    expect(audit.action).toBe('void')
    expect(Number(audit.entityId)).toBe(Number(order.id))
    expect(Number(audit.store)).toBe(Number(location.id))
    expect(Number(audit.userId)).toBe(KASIR_ID)
    expect(audit.description).toContain(reason)
    expect(audit.newValues && audit.newValues.reason).toBe(reason)
  })

  test('11+12. repeat cancellation creates no duplicate refund or audit', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const first = await cancelOrder(kasirToken, order.id, { reason: 'No show' })
    expect(first.status).toBe(200)
    expect(await refundTxns(order.id)).toHaveLength(1)
    expect(await voidAudits(order.id)).toHaveLength(1)
    // Repeat without reason: still a no-op success, no new side effects.
    const second = await cancelOrder(kasirToken, order.id)
    expect(second.status).toBe(200)
    expect(await refundTxns(order.id)).toHaveLength(1)
    expect(await voidAudits(order.id)).toHaveLength(1)
  })

  test('non-string reason is rejected by validation', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const res = await cancelOrder(kasirToken, order.id, { reason: 12345 })
    expect([400, 422]).toContain(res.status)
    const still = await db.order.findByPk(order.id)
    expect(still.status).toBe('paid')
  })

  test('excessively long reason is rejected', async () => {
    const { order } = await createPaidOrder(kasirToken)
    const res = await cancelOrder(kasirToken, order.id, { reason: 'x'.repeat(501) })
    expect([400, 422]).toContain(res.status)
    const still = await db.order.findByPk(order.id)
    expect(still.status).toBe('paid')
  })

  test('13. unrelated paid settlement behavior unchanged (no reason needed)', async () => {
    const prod = await makeProduct(50)
    const res = await request(app)
      .post('/order/create')
      .set('Authorization', `Bearer ${kasirToken}`)
      .send({
        store: location.id,
        items: [{ product: prod.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'Void Reason Cashier'
      })
    expect(res.status).toBe(201)
    const created = await db.order.findByPk(res.body.data.id)
    expect(created.paymentStatus).toBe('paid')
  })

  test('14. pending-to-paid settlement keeps cashReceived=null and changeGiven=0', async () => {
    const pending = await db.order.create({
      orderNumber: `VOIDRSN-PEND-${Date.now()}`,
      store: location.id,
      status: 'pending',
      paymentStatus: 'unpaid',
      subTotal: 10000,
      totalPrice: 11100,
      totalQuantity: 1,
      paymentMethod: 'qris',
      source: 'qr',
      createdBy: KASIR_ID
    })
    const res = await request(app)
      .put('/order/update-status')
      .set('Authorization', `Bearer ${kasirToken}`)
      .send({ id: pending.id, status: 'paid', store: location.id })
    expect(res.status).toBe(200)
    const txn = await db.transaction.findOne({ where: { order: pending.id } })
    expect(txn).not.toBeNull()
    expect(txn.cashReceived).toBeNull()
    expect(Number(txn.changeGiven)).toBe(0)
  })
})
