process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')
const { postOrderJournal, postOrderCogsJournal } = require('../api/service/accountingService')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let store = null
let category = null
let product = null
let token = null

beforeAll(async () => {
  store = await db.location.create({ name: 'RECON_STORE', status: 'active', timezone: 'Asia/Jakarta' })
  category = await db.category.create({ name: 'RECON_CAT' })
  product = await db.product.create({ nameProduct: 'RECON_PROD', category: category.id, price: 50000, costPrice: 20000, stock: 1000 })
  token = jwt.sign({ id: 98020, userName: 'recon_admin', roleType: 'admin', store: store.id }, JWT_SECRET)
})

afterAll(async () => {
  await db.journal_entry_line.destroy({ where: {}, force: true })
  await db.journal_entry.destroy({ where: { store: store.id }, force: true })
  await db.order_item.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: store.id }, force: true })
  await db.product.destroy({ where: { id: product.id }, force: true })
  await db.category.destroy({ where: { id: category.id }, force: true })
  await db.location.destroy({ where: { id: store.id }, force: true })
})

afterEach(async () => {
  await db.journal_entry_line.destroy({ where: {}, force: true })
  await db.journal_entry.destroy({ where: { store: store.id }, force: true })
  await db.order_item.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: store.id }, force: true })
})

const makeOrder = async ({ subTotal, discountAmount, totalPrice, status = 'paid', paymentStatus = 'paid', hppSnapshot = 20000 }) => {
  const order = await db.order.create({
    orderNumber: `RECON-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    store: store.id,
    status,
    paymentStatus,
    subTotal,
    discountAmount,
    totalQuantity: 1,
    totalPrice,
    totalCovers: 1,
    source: 'pos',
    createdAt: new Date()
  })
  await db.order_item.create({
    order: order.id,
    product: product.id,
    productName: product.nameProduct,
    quantity: 1,
    price: subTotal,
    totalPrice: subTotal,
    hppSnapshot,
    status: 'served'
  })
  return order
}

describe('Reconciliation: sales revenue vs accounting journal', () => {
  test('single paid order revenue reconciles', async () => {
    const order = await makeOrder({ subTotal: 50000, discountAmount: 5000, totalPrice: 45000 })
    // Post accounting journals as the order flow does
    await postOrderJournal({
      store: store.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      subTotal: 50000,
      discountAmount: 5000,
      taxAmount: 0,
      serviceChargeAmount: 0,
      totalPrice: 45000,
      date: new Date(),
      createdBy: 98020
    })
    await postOrderCogsJournal({
      store: store.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      date: new Date(),
      createdBy: 98020
    })

    // Reporting daily should show netRevenue 45000 (subTotal - discount)
    const rangeStart = new Date(Date.now() - 86400000).toISOString().slice(0,10)
    const rangeEnd = new Date(Date.now() + 86400000).toISOString().slice(0,10)
    const res = await request(app)
      .get('/report/daily')
      .set('Authorization', `Bearer ${token}`)
      .query({ startDate: rangeStart, endDate: rangeEnd })
    expect(res.status).toBe(200)
    const totalBersih = res.body.data.reduce((s, r) => s + (r.totalPenjualanBersih || 0), 0)
    expect(totalBersih).toBe(45000)

    // Accounting: sum of revenue journals (account 4000) should be 45000 (sub - disc)
    const revenueRows = await db.sequelize.query(
      `SELECT COALESCE(SUM(l.credit),0) as sum FROM journal_entry_line l JOIN journal_entry j ON j.id=l."journalEntry" WHERE j.store=:store AND j."sourceType"='order'`,
      { replacements: { store: store.id }, type: db.sequelize.QueryTypes.SELECT }
    )
    expect(Number(revenueRows[0].sum)).toBe(45000)
  })

  test('cancelled order is excluded from reporting and has reversal journal', async () => {
    const order = await makeOrder({ subTotal: 50000, discountAmount: 0, totalPrice: 50000, status: 'paid', paymentStatus: 'paid' })
    // Post original journals
    await postOrderJournal({
      store: store.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      subTotal: 50000,
      discountAmount: 0,
      taxAmount: 0,
      serviceChargeAmount: 0,
      totalPrice: 50000,
      date: new Date(),
      createdBy: 98020
    })
    await postOrderCogsJournal({
      store: store.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      date: new Date(),
      createdBy: 98020
    })
    // Cancel via controller (which sets paymentStatus to refunded and creates reversal)
    const cancelRes = await request(app)
      .put('/order/update-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: order.id, status: 'cancelled', reason: 'Reporting test void reason' })
    expect(cancelRes.status).toBe(200)

    const updated = await db.order.findByPk(order.id)
    expect(updated.status).toBe('cancelled')
    expect(updated.paymentStatus).toBe('refunded')

    // Reporting should exclude cancelled
    const rangeStart = new Date(Date.now() - 86400000).toISOString().slice(0,10)
    const rangeEnd = new Date(Date.now() + 86400000).toISOString().slice(0,10)
    const res = await request(app)
      .get('/report/daily')
      .set('Authorization', `Bearer ${token}`)
      .query({ startDate: rangeStart, endDate: rangeEnd })
    expect(res.status).toBe(200)
    const totalBersih = res.body.data.reduce((s, r) => s + (r.totalPenjualanBersih || 0), 0)
    // Cancelled order should not contribute (0)
    expect(totalBersih).toBe(0)

    // Accounting: should have reversal journals
    const reversals = await db.journal_entry.findAll({ where: { store: store.id, sourceType: 'order_reversal' } })
    expect(reversals.length).toBe(1)
    const cogsReversals = await db.journal_entry.findAll({ where: { store: store.id, sourceType: 'cogs_reversal' } })
    expect(cogsReversals.length).toBe(1)
  })
})

describe('Reconciliation: COGS vs HPP', () => {
  test('HPP reconciles between daily and COGS journal', async () => {
    const order = await makeOrder({ subTotal: 50000, discountAmount: 0, totalPrice: 50000, hppSnapshot: 20000 })
    await postOrderCogsJournal({
      store: store.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      date: new Date(),
      createdBy: 98020
    })

    const rangeStart = new Date(Date.now() - 86400000).toISOString().slice(0,10)
    const rangeEnd = new Date(Date.now() + 86400000).toISOString().slice(0,10)
    const res = await request(app)
      .get('/report/daily')
      .set('Authorization', `Bearer ${token}`)
      .query({ startDate: rangeStart, endDate: rangeEnd })
    const totalHpp = res.body.data.reduce((s, r) => s + (r.totalHpp || 0), 0)
    expect(totalHpp).toBe(20000)

    const cogsRows = await db.sequelize.query(
      `SELECT COALESCE(SUM(l.debit),0) as sum FROM journal_entry_line l JOIN journal_entry j ON j.id=l."journalEntry" WHERE j.store=:store AND j."sourceType"='cogs'`,
      { replacements: { store: store.id }, type: db.sequelize.QueryTypes.SELECT }
    )
    expect(Number(cogsRows[0].sum)).toBe(20000)
  })
})
