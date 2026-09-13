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
let taxConfig = null
let cashierToken = null

beforeAll(async () => {
  location = await db.location.create({ name: 'TAX_STORE', status: 'active' })
  category = await db.category.create({ name: 'TAX_CAT' })
  product = await db.product.create({
    nameProduct: 'TAX_PRODUCT',
    category: category.id,
    price: 15000,
    stock: 100
  })
  await db.product_store_stock.create({ product: product.id, store: location.id, stock: 100 })
  // Ensure tax config 11% exists for this store
  taxConfig = await db.taxConfig.findOne({ where: { store: location.id, type: 'ppn' } })
  if (!taxConfig) {
    taxConfig = await db.taxConfig.create({
      store: location.id,
      type: 'ppn',
      rate: 11,
      status: 'active',
      name: 'PPN'
    })
  } else {
    await taxConfig.update({ rate: 11, status: 'active' })
  }
  cashierToken = jwt.sign(
    { id: 9802, userName: 'tax_cashier', roleType: 'kasir', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.order_item.destroy({ where: {}, force: true })
  await db.transaction.destroy({ where: {}, force: true })
  await db.order_status.destroy({ where: {}, force: true })
  await db.order.destroy({ where: { store: location.id }, force: true })
  await db.taxConfig.destroy({ where: { id: taxConfig?.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

const createOrder = (body) =>
  request(app)
    .post('/order/create')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      store: location.id,
      items: [{ product: product.id, quantity: 1 }],
      paymentMethod: 'cash',
      cashierName: 'Tax Cashier',
      ...body
    })

describe('Phase 18 Tax Toggle', () => {
  test('useTax true → taxAmount 1650 total 16650', async () => {
    const res = await createOrder({ useTax: true })
    expect(res.status).toBe(201)
    expect(res.body.data.taxAmount).toBe(1650)
    expect(res.body.data.totalPrice).toBe(16650)
  })

  test('useTax false → taxAmount 0 total 15000', async () => {
    const res = await createOrder({ useTax: false })
    expect(res.status).toBe(201)
    expect(res.body.data.taxAmount).toBe(0)
    expect(res.body.data.totalPrice).toBe(15000)
  })

  test('client fake taxRate 0 with useTax true is ignored', async () => {
    const res = await createOrder({ useTax: true, taxRate: 0, taxAmount: 0, totalPrice: 15000 })
    expect(res.status).toBe(201)
    expect(res.body.data.taxAmount).toBe(1650)
    expect(res.body.data.totalPrice).toBe(16650)
  })

  test('client fake taxAmount with useTax false is ignored', async () => {
    const res = await createOrder({ useTax: false, taxRate: 11, taxAmount: 1650, totalPrice: 16650 })
    expect(res.status).toBe(201)
    expect(res.body.data.taxAmount).toBe(0)
    expect(res.body.data.totalPrice).toBe(15000)
  })
})
