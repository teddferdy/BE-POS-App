process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// C-11 regression — updatePriceByStore 'base' sentinel cross-tenant price influence.
//
// `product.price` (the "base" price) is the authoritative unit price used at
// CHECKOUT for every store that sells the product (getServerItemPrice reads
// prod.price; product_store_price rows are never consulted at checkout).
// Previously a store A admin could call updatePriceByStore with
// storePrices:[{storeId:'base', price:...}] against a product loaded by an
// UNscoped findByPk(productId) and rewrite product.price — mutating the price
// every other store observes at their own checkout. The N-2 fix only blocked
// foreign NUMERIC storeIds and explicitly exempted 'base'.
//
// Remediation: `product.price` is a global/shared attribute. Only super_admin
// may write it. A tenant admin may only touch their own store's
// product_store_price rows (which are non-authoritative at checkout and carry
// no cross-tenant effect), never the shared base price.

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let storeA = null
let storeB = null
let category = null
let product = null
let adminA = null
let superToken = null

beforeAll(async () => {
  storeA = await db.location.create({ name: 'C11_STORE_A', status: 'active' })
  storeB = await db.location.create({ name: 'C11_STORE_B', status: 'active' })
  category = await db.category.create({ name: 'C11_CAT', status: 'active' })
  product = await db.product.create({
    nameProduct: 'C11_Product',
    category: category.id,
    price: 1000,
    costPrice: 500,
    stock: 10
  })
  // Product is sold ONLY at store B (shared base price consumed at B's checkout).
  await db.product_store.create({ product: product.id, store: storeB.id })

  adminA = jwt.sign(
    { id: 97111, userName: 'c11_admin_a', roleType: 'admin', store: storeA.id },
    JWT_SECRET
  )
  superToken = jwt.sign(
    { id: 97110, userName: 'c11_super', roleType: 'super_admin' },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.product_store.destroy({ where: { product: product?.id }, force: true })
  await db.product_store_price.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id] }, force: true })
})

describe('C-11 base price (product.price) cross-tenant write', () => {
  test('store A admin cannot write the SHARED base price of a product sold at store B', async () => {
    const res = await request(app)
      .put('/pos/product/update-price-by-store')
      .set('Authorization', `Bearer ${adminA}`)
      .send({ productId: product.id, storePrices: [{ storeId: 'base', price: 99999 }] })
    expect(res.status).toBe(403)
    const row = await db.product.findByPk(product.id)
    expect(Number(row.price)).toBe(1000)
  })

  test('store A admin cannot write base price even for a product; only super may', async () => {
    // store A admin attempt on the base price of any product must be rejected.
    const res = await request(app)
      .put('/pos/product/update-price-by-store')
      .set('Authorization', `Bearer ${adminA}`)
      .send({ productId: product.id, storePrices: [{ storeId: 'base', price: 11111 }] })
    expect(res.status).toBe(403)
    const row = await db.product.findByPk(product.id)
    expect(Number(row.price)).toBe(1000)
  })

  test('super_admin may write the shared base price (intentional global scope)', async () => {
    const res = await request(app)
      .put('/pos/product/update-price-by-store')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ productId: product.id, storePrices: [{ storeId: 'base', price: 7777 }] })
    expect(res.status).toBe(200)
    const row = await db.product.findByPk(product.id)
    expect(Number(row.price)).toBe(7777)
  })

  test('store A admin can still update their OWN store-specific price row (no cross-tenant effect)', async () => {
    await db.product_store_price.findOrCreate({
      where: { product: product.id, store: storeA.id },
      defaults: { price: 2000 }
    })
    const res = await request(app)
      .put('/pos/product/update-price-by-store')
      .set('Authorization', `Bearer ${adminA}`)
      .send({ productId: product.id, storePrices: [{ storeId: String(storeA.id), price: 4000 }] })
    expect(res.status).toBe(200)
    const row = await db.product_store_price.findOne({
      where: { product: product.id, store: storeA.id }
    })
    expect(Number(row.price)).toBe(4000)
  })
})
