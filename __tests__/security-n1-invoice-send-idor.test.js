process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'
process.env.FONNTE_TOKEN = 'test-token'

// N-1 regression: pos sendInvoiceWhatsApp / sendInvoiceEmail loaded the order
// by findByPk(orderId) with NO tenant scoping, letting a store A user disclose
// and exfiltrate a store B order via WhatsApp/email. Both must now scope the
// order load to req.storeId / the caller's store and reject foreign orders
// before any external send is attempted.
jest.mock('../utils/whatsappClient', () => {
  const actual = jest.requireActual('../utils/whatsappClient')
  return {
    ...actual,
    getConnectionStatus: jest.fn(async () => ({ ready: true, hasQR: false, qrBase64: null, error: null })),
    sendDocument: jest.fn(async () => {})
  }
})

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const whatsapp = require('../utils/whatsappClient')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let store1 = null
let store2 = null
let category = null
let order1 = null
let order2 = null
let userAdmin1 = null
let userSuper = null
let admin1Token = null
let superToken = null

beforeAll(async () => {
  store1 = await db.location.create({ name: 'N1_STORE_A', status: 'active' })
  store2 = await db.location.create({ name: 'N1_STORE_B', status: 'active' })
  category = await db.category.create({ name: 'N1_CAT', status: 'active' })

  const suffix = Date.now()
  userAdmin1 = await db.user.create({
    id: 9701,
    userName: `n1_admin_a_${suffix}`,
    roleType: 'admin',
    store: store1.id,
    password: 'x'
  })
  userSuper = await db.user.create({
    id: 9700,
    userName: `n1_super_${suffix}`,
    roleType: 'super_admin',
    password: 'x'
  })

  admin1Token = jwt.sign(
    { id: userAdmin1.id, userName: userAdmin1.userName, roleType: 'admin', store: store1.id },
    JWT_SECRET
  )
  superToken = jwt.sign(
    { id: userSuper.id, userName: userSuper.userName, roleType: 'super_admin' },
    JWT_SECRET
  )

  order1 = await db.order.create({
    orderNumber: `N1-ORD-${suffix}-A`,
    store: store1.id,
    status: 'pending',
    paymentStatus: 'paid',
    totalPrice: 25000,
    subTotal: 25000,
    customerName: 'N1 Customer A'
  })
  order2 = await db.order.create({
    orderNumber: `N1-ORD-${suffix}-B`,
    store: store2.id,
    status: 'pending',
    paymentStatus: 'paid',
    totalPrice: 99999,
    subTotal: 99999,
    customerName: 'N1 LEAKED Customer B'
  })
})

afterAll(async () => {
  await db.order_item.destroy({ where: { order: [order1?.id, order2?.id].filter(Boolean) }, force: true })
  await db.order.destroy({ where: { id: [order1?.id, order2?.id].filter(Boolean) }, force: true })
  await db.auditLog.destroy({ where: { userId: [userAdmin1?.id, userSuper?.id].filter(Boolean) }, force: true })
  await db.user.destroy({ where: { id: [userAdmin1?.id, userSuper?.id].filter(Boolean) }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: [store1?.id, store2?.id].filter(Boolean) }, force: true })
})

beforeEach(() => {
  whatsapp.sendDocument.mockClear()
})

describe('N-1 POS invoice send tenant isolation', () => {
  test('store A admin sending store B order via WhatsApp is rejected without leaking details', async () => {
    const res = await request(app)
      .post('/pos/invoice/send-wa')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ orderId: order2.id, phone: '6281234567890' })

    expect([403, 404]).toContain(res.status)
    // response must not reveal store B order fields
    expect(JSON.stringify(res.body)).not.toContain('N1 LEAKED Customer B')
    expect(JSON.stringify(res.body)).not.toContain(String(order2.totalPrice))
  })

  test('no WhatsApp side effect fires when sending a foreign order', async () => {
    await request(app)
      .post('/pos/invoice/send-wa')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ orderId: order2.id, phone: '6281234567890' })

    expect(whatsapp.sendDocument).not.toHaveBeenCalled()
  })

  test('store A admin sending their OWN order via WhatsApp still works', async () => {
    const res = await request(app)
      .post('/pos/invoice/send-wa')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ orderId: order1.id, phone: '6281234567890' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(whatsapp.sendDocument).toHaveBeenCalledTimes(1)
  })

  test('store A admin sending store B order via email is rejected without leaking details', async () => {
    const res = await request(app)
      .post('/pos/invoice/send-email')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ orderId: order2.id, email: 'attacker@example.com' })

    expect([403, 404]).toContain(res.status)
    expect(JSON.stringify(res.body)).not.toContain('N1 LEAKED Customer B')
  })

  test('store A admin sending their OWN order via email still works', async () => {
    const res = await request(app)
      .post('/pos/invoice/send-email')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ orderId: order1.id, email: 'own@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('super_admin sending a store B order via WhatsApp still works (intentional)', async () => {
    const res = await request(app)
      .post('/pos/invoice/send-wa')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ orderId: order2.id, phone: '6281234567890' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('rejected foreign order does not mutate database state', async () => {
    const before = await db.order.findByPk(order2.id)
    await request(app)
      .post('/pos/invoice/send-wa')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ orderId: order2.id, phone: '6281234567890' })
    const after = await db.order.findByPk(order2.id)
    expect(after.orderNumber).toBe(before.orderNumber)
    expect(after.totalPrice).toBe(before.totalPrice)
  })
})
