process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

let location = null
let category = null
let adminToken = null

beforeAll(async () => {
  location = await db.location.create({ name: 'PROD_EDIT_STORE', status: 'active' })
  category = await db.category.create({ name: 'PROD_EDIT_CATEGORY' })
  adminToken = jwt.sign(
    { id: 7401, userName: 'admin_prod_edit', roleType: 'admin', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.stock_history.destroy({ where: {}, force: true })
  await db.product_store_stock.destroy({ where: { store: location.id }, force: true })
  await db.product_store.destroy({ where: { store: location.id }, force: true })
  await db.product.destroy({ where: { category: category.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

describe('PUT /product/edit-product — manual stock edit', () => {
  test('editing stock updates product, per-store stock, and stock_history atomically', async () => {
    const product = await db.product.create({
      nameProduct: 'PROD_EDIT_ITEM',
      category: category.id,
      price: 10000,
      stock: 20
    })
    await db.product_store_stock.create({
      product: product.id,
      store: location.id,
      stock: 20
    })

    const res = await request(app)
      .put('/product/edit-product')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id: product.id,
        nameProduct: 'PROD_EDIT_ITEM',
        stock: 35,
        storeId: location.id
      })

    expect(res.status).toBe(200)

    const afterProduct = await db.product.findByPk(product.id)
    expect(afterProduct.stock).toBe(35)

    const afterStoreStock = await db.product_store_stock.findOne({
      where: { product: product.id, store: location.id }
    })
    expect(afterStoreStock.stock).toBe(35)

    const history = await db.stock_history.findAll({
      where: { product: product.id, referenceType: 'adjustment' }
    })
    expect(history.length).toBe(1)
    expect(history[0].quantityBefore).toBe(20)
    expect(history[0].quantityAfter).toBe(35)
    expect(history[0].quantityChange).toBe(15)
  })

  test('two concurrent edits of the same product: both apply serially, neither is lost', async () => {
    const product = await db.product.create({
      nameProduct: 'PROD_EDIT_RACE',
      category: category.id,
      price: 10000,
      stock: 10
    })
    await db.product_store_stock.create({
      product: product.id,
      store: location.id,
      stock: 10
    })

    // Both requests read the pre-edit stock (10) from the client's point of
    // view and each tries to set an absolute new value — this is the
    // realistic race (two managers editing the same product's stock at
    // the same time from two different values), not a delta race. Locking
    // must at least serialize the two writes so the second one's
    // stockDiff/audit trail is computed against the FIRST write's actual
    // committed result, not a stale pre-transaction read.
    const [r1, r2] = await Promise.all([
      request(app)
        .put('/product/edit-product')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: product.id, nameProduct: 'PROD_EDIT_RACE', stock: 25, storeId: location.id }),
      request(app)
        .put('/product/edit-product')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: product.id, nameProduct: 'PROD_EDIT_RACE', stock: 30, storeId: location.id })
    ])

    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)

    const finalProduct = await db.product.findByPk(product.id)
    // Whichever write committed last determines the final absolute value —
    // must be one of the two requested values, not something else (e.g.
    // not a torn/partial write, not the original 10).
    expect([25, 30]).toContain(finalProduct.stock)

    // The per-store shadow must have converged to the SAME final value as
    // product.stock, not diverged — proof the two deltas were computed
    // against a consistent, serialized sequence of locked reads rather
    // than each racing off the same stale baseline.
    const finalStoreStock = await db.product_store_stock.findOne({
      where: { product: product.id, store: location.id }
    })
    expect(finalStoreStock.stock).toBe(finalProduct.stock)

    // Two edits happened, so two audit entries — and their before/after
    // values must chain (second entry's quantityBefore === first entry's
    // quantityAfter), proving neither wrote from a stale snapshot.
    const history = await db.stock_history.findAll({
      where: { product: product.id, referenceType: 'adjustment' },
      order: [['id', 'ASC']]
    })
    expect(history.length).toBe(2)
    expect(history[1].quantityBefore).toBe(history[0].quantityAfter)
    expect(history[1].quantityAfter).toBe(finalProduct.stock)
  })
})
