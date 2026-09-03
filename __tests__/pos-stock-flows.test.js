process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let storeA = null
let storeB = null
let category = null
let productAdjust = null
let productTransfer = null
let adminAUser = null
let superAdminUser = null
let adminAToken = null
let superAdminToken = null

beforeAll(async () => {
  storeA = await db.location.create({ name: 'POS_FLOW_STORE_A', status: 'active' })
  storeB = await db.location.create({ name: 'POS_FLOW_STORE_B', status: 'active' })
  category = await db.category.create({ name: 'POS_FLOW_CATEGORY' })

  productAdjust = await db.product.create({
    nameProduct: 'POS_FLOW_ADJUST_PRODUCT',
    category: category.id,
    price: 3000,
    stock: 10
  })
  productTransfer = await db.product.create({
    nameProduct: 'POS_FLOW_TRANSFER_PRODUCT',
    category: category.id,
    price: 4000,
    stock: 15
  })
  // transfer reads availability from product_store_stock at the source
  // store, not the base product.stock — seed it like a store that has
  // already been through stock opname/goods receipt.
  await db.product_store_stock.create({
    product: productTransfer.id,
    store: storeA.id,
    stock: 15
  })

  // stock_transfer.createdBy FKs to user.id (unlike order/transaction/
  // stock_history, which don't) — the token subject needs a real user row.
  adminAUser = await db.user.create({
    userName: 'admin_pos_flow_a',
    email: 'admin_pos_flow_a@test.com',
    roleType: 'admin',
    userType: 'admin',
    store: storeA.id,
    status: 'active'
  })
  superAdminUser = await db.user.create({
    userName: 'superadmin_pos_flow',
    email: 'superadmin_pos_flow@test.com',
    roleType: 'super_admin',
    userType: 'admin',
    status: 'active'
  })

  adminAToken = jwt.sign(
    {
      id: adminAUser.id,
      userName: adminAUser.userName,
      roleType: 'admin',
      store: storeA.id
    },
    JWT_SECRET
  )
  superAdminToken = jwt.sign(
    { id: superAdminUser.id, userName: superAdminUser.userName, roleType: 'super_admin' },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.stock_transfer_item.destroy({ where: {}, force: true })
  await db.stock_transfer.destroy({
    where: { fromStore: [storeA?.id, storeB?.id] },
    force: true
  })
  await db.user.destroy({
    where: { id: [adminAUser?.id, superAdminUser?.id].filter(Boolean) },
    force: true
  })
  await db.stock_history.destroy({
    where: { product: [productAdjust?.id, productTransfer?.id] },
    force: true
  })
  await db.product_store_stock.destroy({
    where: { product: [productAdjust?.id, productTransfer?.id] },
    force: true
  })
  await db.product.destroy({
    where: { id: [productAdjust?.id, productTransfer?.id] },
    force: true
  })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id] }, force: true })
})

describe('POST /pos/adjust — stock adjustment', () => {
  test('positive adjustment increases stock and records stock_history', async () => {
    const res = await request(app)
      .post('/pos/adjust')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ productId: productAdjust.id, qty: 5, reason: 'Restock' })

    expect(res.status).toBe(200)

    const fresh = await db.product.findByPk(productAdjust.id)
    expect(fresh.stock).toBe(15)

    const history = await db.stock_history.findAll({
      where: { product: productAdjust.id, referenceType: 'adjustment' }
    })
    expect(history.length).toBe(1)
    expect(history[0].quantityChange).toBe(5)
  })

  test('rejects an adjustment that would take stock negative', async () => {
    const res = await request(app)
      .post('/pos/adjust')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ productId: productAdjust.id, qty: -999, reason: 'Bad adjustment' })

    expect(res.status).toBe(400)

    const fresh = await db.product.findByPk(productAdjust.id)
    expect(fresh.stock).toBe(15)
  })
})

describe('POST /pos/transfer — inter-store stock transfer', () => {
  test('moves stock from the source store to the destination store', async () => {
    const res = await request(app)
      .post('/pos/transfer')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        fromStore: storeA.id,
        toStore: storeB.id,
        items: [{ productId: productTransfer.id, qty: 6 }]
      })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('sent')

    const sourceStock = await db.product_store_stock.findOne({
      where: { product: productTransfer.id, store: storeA.id }
    })
    expect(sourceStock.stock).toBe(9)

    const baseProduct = await db.product.findByPk(productTransfer.id)
    expect(baseProduct.stock).toBe(9)
  })

  test('rejects a transfer with the same source and destination store', async () => {
    const res = await request(app)
      .post('/pos/transfer')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        fromStore: storeA.id,
        toStore: storeA.id,
        items: [{ productId: productTransfer.id, qty: 1 }]
      })

    expect(res.status).toBe(400)
  })

  test('rejects a transfer sourced from a store the admin does not belong to', async () => {
    const res = await request(app)
      .post('/pos/transfer')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        fromStore: storeB.id, // adminAToken belongs to storeA, not storeB
        toStore: storeA.id,
        items: [{ productId: productTransfer.id, qty: 1 }]
      })

    expect(res.status).toBe(403)
  })

  test('super_admin can transfer from any store', async () => {
    const before = await db.product_store_stock.findOne({
      where: { product: productTransfer.id, store: storeA.id }
    })

    const res = await request(app)
      .post('/pos/transfer')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        fromStore: storeA.id,
        toStore: storeB.id,
        items: [{ productId: productTransfer.id, qty: 2 }]
      })

    expect(res.status).toBe(201)

    const after = await db.product_store_stock.findOne({
      where: { product: productTransfer.id, store: storeA.id }
    })
    expect(after.stock).toBe(before.stock - 2)
  })
})
