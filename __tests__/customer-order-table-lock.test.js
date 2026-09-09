// F-05 — regression: createCustomerOrder must re-read the table row under a
// FOR UPDATE lock inside the SAME transaction that creates the booking, and
// re-check its status from that locked value (the pre-transaction check is a
// fast-path 400 only). This serializes a booking against concurrent
// table-status mutations (operator update, queue seat activation) instead of
// racing them.
//
// The pure table-status RACE (two concurrent distinct-key submits both
// reading 'available' before either writes) is timing-dependent and not
// deterministically reproducible at the HTTP layer; it is additionally
// documented as a residual, because a DB-level "one live order per table"
// unique index is not deployable on current data (dev already contains
// multiple live orders per table) and booking-blocking would change product
// table semantics. This file pins the authoritative locked-recheck path and
// the current booking semantics so neither regresses silently.

process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const app = require('../api/index')
const db = require('../db/models')

let store = null
let category = null
let product = null
let table = null

const createBooking = (tableId, key) =>
  request(app).post('/order/customer-create').send({
    store: store.id,
    tableId,
    customerName: 'F05 Locked Recheck',
    idempotencyKey: key,
    items: [{ productId: product.id, productName: product.nameProduct, quantity: 1 }]
  })

beforeAll(async () => {
  store = await db.location.create({ name: 'F05_TABLE_LOCK_STORE', status: 'active' })
  category = await db.category.create({ name: 'F05_TABLE_LOCK_CATEGORY' })
  product = await db.product.create({
    nameProduct: 'F05_TABLE_LOCK_PRODUCT',
    category: category.id,
    price: 12000,
    stock: 50,
    isAvailable: true
  })
  await db.product_store_stock.create({
    product: product.id,
    store: store.id,
    stock: product.stock
  })
  table = await db.table.create({ store: store.id, name: 'F05_TABLE', status: 'available' })
})

afterAll(async () => {
  const orders = await db.order.findAll({ where: { store: store.id } })
  for (const o of orders) {
    await db.order_item.destroy({ where: { order: o.id }, force: true })
    await db.order_status.destroy({ where: { order: o.id }, force: true })
    await db.transaction.destroy({ where: { order: o.id }, force: true })
    await db.order.destroy({ where: { id: o.id }, force: true })
  }
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.table.destroy({ where: { id: table?.id }, force: true })
  await db.location.destroy({ where: { id: store?.id }, force: true })
})

describe('F-05 — createCustomerOrder authoritative in-transaction table check', () => {
  test('books an available table (201); the locked recheck rejects an occupied table (400)', async () => {
    const first = await createBooking(table.id, `f05-ok-${Date.now()}`)
    expect(first.status).toBe(201)
    expect(first.body.data.paymentStatus).toBe('unpaid')

    // Booking alone does NOT change the table status today (operator-managed
    // occupancy) — the row-lock only serializes against concurrent mutations.
    const afterFirst = await db.table.findByPk(table.id)
    expect(afterFirst.status).toBe('available')

    await db.table.update({ status: 'occupied' }, { where: { id: table.id } })

    const blocked = await createBooking(table.id, `f05-blocked-${Date.now()}`)
    expect(blocked.status).toBe(400)
    expect(blocked.body.message).toBe('Table is already occupied')

    await db.table.update({ status: 'available' }, { where: { id: table.id } })

    const again = await createBooking(table.id, `f05-again-${Date.now()}`)
    expect(again.status).toBe(201)
  })
})