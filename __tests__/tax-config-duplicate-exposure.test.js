process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const { signSessionToken } = require('../test-helpers/authSession')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// T2 (design D3): two active global PPN 11% rows currently resolve to a
// combined 22% rate (stacking). This test pins that observable behavior so
// the duplicate-configuration risk is visible and any future resolution
// (priority, rejection, or approved stacking) must update it deliberately.
// It asserts current behavior only — not business approval of stacking.
let store = null
let category = null
let product = null
let table = null
let cashierToken = null

beforeAll(async () => {
  store = await db.location.create({ name: 'T2_DUP_STORE', status: 'active' })
  category = await db.category.create({ name: 'T2_DUP_CAT' })
  product = await db.product.create({
    nameProduct: 'T2_DUP_PRODUCT',
    category: category.id,
    price: 10000,
    stock: 100
  })
  await db.product_store_stock.create({ product: product.id, store: store.id, stock: 100 })
  await db.product_store.create({ product: product.id, store: store.id })
  await db.user.create({
    id: 9931,
    userName: 't2_dup_cashier',
    email: 'p1-9931-t2@test.com',
    roleType: 'kasir',
    userType: 'user',
    store: store.id,
    status: 'active',
    fullName: 't2_dup_cashier'
  })
  cashierToken = await signSessionToken(
    { id: 9931, userName: 't2_dup_cashier', roleType: 'kasir', store: store.id },
    JWT_SECRET
  )
  await db.cashRegister.create({ store: store.id, user: 9931, status: 'open', openingBalance: 0, openedAt: new Date() })
  table = await db.table.create({ store: store.id, name: 'T2_DUP_TABLE', capacity: 4 })
  await db.taxConfig.create({ name: 'T2_DUP_PPN_A', rate: 11, type: 'ppn', status: 'active', store: null })
  await db.taxConfig.create({ name: 'T2_DUP_PPN_B', rate: 11, type: 'ppn', status: 'active', store: null })
})

afterAll(async () => {
  await db.cashRegister.destroy({ where: { store: store?.id }, force: true })
  await db.user.destroy({ where: { id: [9931] }, force: true })
  await db.taxConfig.destroy({ where: { name: ['T2_DUP_PPN_A', 'T2_DUP_PPN_B'] }, force: true })
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: store?.id }, force: true })
  await db.table.destroy({ where: { id: table?.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.product_store.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: store?.id }, force: true })
})

describe('duplicate global PPN exposure (T2)', () => {
  test('two active global 11% rows combine to a 22% effective rate', async () => {
    const res = await request(app)
      .post('/order/create')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        store: store.id,
        items: [{ product: product.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashierName: 'T2 Dup'
      })
    expect(res.status).toBe(201)
    // 10000 base with two stacked global 11% rows: 22% combined.
    expect(Number(res.body.data.taxAmount)).toBe(2200)
    expect(Number(res.body.data.totalPrice)).toBe(12200)
  })
})
