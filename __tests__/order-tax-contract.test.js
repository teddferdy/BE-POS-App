process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let location = null
let category = null
let productA = null
let cashierToken = null

beforeAll(async () => {
  location = await db.location.create({ name: 'TAX_CT_STORE', status: 'active' })
  category = await db.category.create({ name: 'TAX_CT_CATEGORY' })
  productA = await db.product.create({
    nameProduct: 'TAX_CT_PRODUCT_A',
    category: category.id,
    price: 10000,
    stock: 100
  })
  // Match the store-scoped stock row a live store would have.
  await db.product_store_stock.create({ product: productA.id, store: location.id, stock: 100 })
  cashierToken = jwt.sign(
    { id: 7002, userName: 'cashier_tax_ct', roleType: 'kasir', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.taxConfig.destroy({ where: { store: null, name: 'TEST_GLOBAL_PPN' }, force: true })
  await db.taxConfig.destroy({ where: { store: location.id }, force: true })
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: location.id }, force: true })
  await db.best_selling.destroy({ where: { productId: productA?.id }, force: true })
  await db.stock_history.destroy({ where: { product: productA?.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: productA?.id }, force: true })
  await db.product.destroy({ where: { id: productA?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

const orderOne = (overrides = {}) =>
  request(app)
    .post('/order/create')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      store: location.id,
      items: [{ product: productA.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'Tax Contract',
      ...overrides
    })

describe('tax config resolution contract (F-SMOKE-01)', () => {
  test('a global (store: null) active PPN config prices the order — not the 11% fallback', async () => {
    await db.taxConfig.destroy({ where: { store: null, name: 'TEST_GLOBAL_PPN' }, force: true })
    await db.taxConfig.create({
      name: 'TEST_GLOBAL_PPN',
      rate: 7,
      type: 'ppn',
      status: 'active',
      store: null
    })

    const res = await orderOne()

    expect(res.status).toBe(201)
    // 10000 @ 7% — the global config must win over the undocumented 11% fallback.
    expect(Number(res.body.data.taxAmount)).toBe(700)
    expect(Number(res.body.data.totalPrice)).toBe(10700)
  })

  test('global and per-store active PPN rates stack, matching the tax list the UI fetches', async () => {
    await db.taxConfig.destroy({ where: { store: null, name: 'TEST_GLOBAL_PPN' }, force: true })
    await db.taxConfig.destroy({ where: { store: location.id, name: 'TEST_STORE_PPN' }, force: true })
    await db.taxConfig.create({
      name: 'TEST_GLOBAL_PPN',
      rate: 7,
      type: 'ppn',
      status: 'active',
      store: null
    })
    await db.taxConfig.create({
      name: 'TEST_STORE_PPN',
      rate: 9,
      type: 'ppn',
      status: 'active',
      store: location.id
    })

    const res = await orderOne()

    expect(res.status).toBe(201)
    // GET /tax-config returns store rows OR global rows — so the UI sums 16%;
    // the order price must never diverge from what the UI displayed.
    expect(Number(res.body.data.taxAmount)).toBe(1600)
    expect(Number(res.body.data.totalPrice)).toBe(11600)
  })

  test('legacy percentage-typed rows are never treated as PPN — the documented 11% default applies when no ppn row exists', async () => {
    await db.taxConfig.destroy({ where: { store: null, name: 'TEST_GLOBAL_PPN' }, force: true })
    await db.taxConfig.destroy({ where: { store: location.id }, force: true })
    await db.taxConfig.create({
      name: 'LEGACY_PERCENTAGE_ROW',
      rate: 5,
      type: 'percentage',
      status: 'active',
      store: location.id
    })

    const res = await orderOne()

    expect(res.status).toBe(201)
    expect(Number(res.body.data.taxAmount)).toBe(1100)
    expect(Number(res.body.data.totalPrice)).toBe(11100)
  })

  test('non-cash payment without cashAmount/changeAmount is accepted', async () => {
    await db.taxConfig.destroy({ where: { store: null, name: 'TEST_GLOBAL_PPN' }, force: true })
    await db.taxConfig.destroy({ where: { store: location.id }, force: true })

    const res = await orderOne({ paymentMethod: 'e-wallet' })

    expect(res.status).toBe(201)
    expect(res.body.data.paymentMethod).toBe('e-wallet')
  })

  test('a global (store: null) active service charge config is applied — the same store-or-global resolution as tax', async () => {
    await db.taxConfig.destroy({ where: { store: null, name: 'TEST_GLOBAL_PPN' }, force: true })
    await db.taxConfig.destroy({ where: { store: location.id }, force: true })
    await db.taxConfig.destroy({
      where: { store: null, name: 'TEST_GLOBAL_SERVICE_CHARGE' },
      force: true
    })
    await db.taxConfig.create({
      name: 'TEST_GLOBAL_PPN',
      rate: 7,
      type: 'ppn',
      status: 'active',
      store: null
    })
    await db.taxConfig.create({
      name: 'TEST_GLOBAL_SERVICE_CHARGE',
      rate: 5,
      type: 'service_charge',
      status: 'active',
      store: null
    })

    const res = await orderOne()

    expect(res.status).toBe(201)
    // 10000 @ 7% ppn = 700; service charge is on the post-discount subtotal,
    // 10000 @ 5% = 500 — a global service_charge row must not be ignored.
    expect(Number(res.body.data.taxAmount)).toBe(700)
    expect(Number(res.body.data.totalPrice)).toBe(11200)

    await db.taxConfig.destroy({
      where: { store: null, name: 'TEST_GLOBAL_SERVICE_CHARGE' },
      force: true
    })
  })
})
