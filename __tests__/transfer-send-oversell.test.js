process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// F-STOCK-3 regression: transfer-send must gate availability inside the
// critical transaction under a row lock.
//
// Investigation note (honest RED story): 20 pre-fix concurrent rounds could
// NOT reproduce oversell — the pre-existing batched sorted product-row lock
// (taken before the gate read) already serializes same-product senders, so
// the gate read is fresh against every writer that also takes the product
// lock (orders, returns, other transfers). These tests therefore pin the
// serialization + rollback invariants rather than a reproduced failure.
// The hardening here holds the source-row lock across gate→decrement
// (additionally serializing against any present-or-future locker of that
// row) and keeps the reject-instead-of-clamp behavior.
//
// NOTE on idempotency: stock_transfer has no idempotencyKey column and no
// unique constraint beyond the server-minted transferNumber, so same-key
// retry protection would require a schema change — explicitly deferred to
// a separate schema batch (no migration in this batch).

let storeA = null
let storeB = null
let category = null
let product = null
let adminToken = null

async function setSourceStock(qty) {
  await db.product_store_stock.destroy({
    where: { product: product.id, store: storeA.id },
    force: true
  })
  await db.product_store_stock.create({
    product: product.id,
    store: storeA.id,
    stock: qty
  })
  await db.product.update({ stock: 1000 }, { where: { id: product.id } })
}

async function sendTransfer(qty) {
  return request(app)
    .post('/pos/transfer')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fromStore: storeA.id,
      toStore: storeB.id,
      items: [{ productId: product.id, qty, unit: 'pcs' }],
      reason: 'F-STOCK-3 probe'
    })
}

async function sourceStock() {
  const row = await db.product_store_stock.findOne({
    where: { product: product.id, store: storeA.id }
  })
  return Number(row?.stock)
}

async function transferCount() {
  return db.stock_transfer.count({
    where: { fromStore: storeA.id, toStore: storeB.id }
  })
}

beforeAll(async () => {
  storeA = await db.location.create({ name: `TRAT_A_${Date.now()}`, status: 'active' })
  storeB = await db.location.create({ name: `TRAT_B_${Date.now()}`, status: 'active' })
  category = await db.category.create({ name: `TRAT_CAT_${Date.now()}` })
  product = await db.product.create({
    nameProduct: `TRAT_PRODUCT_${Date.now()}`,
    category: category.id,
    price: 4000,
    stock: 1000
  })
  // stock_transfer.createdBy FKs to user.id — the token needs a real row.
  const adminUser = await db.user.create({
    userName: `admin_trat_${Date.now()}`,
    email: `admin_trat_${Date.now()}@test.com`,
    roleType: 'admin',
    userType: 'admin',
    store: storeA.id,
    status: 'active'
  })
  adminToken = jwt.sign(
    { id: adminUser.id, userName: adminUser.userName, roleType: 'admin', store: storeA.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.stock_history.destroy({ where: { product: product?.id }, force: true })
  await db.stock_transfer_item.destroy({ where: {}, force: true })
  await db.stock_transfer.destroy({
    where: { fromStore: [storeA?.id, storeB?.id].filter(Boolean) },
    force: true
  })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.user.destroy({ where: { store: storeA?.id }, force: true })
  await db.location.destroy({
    where: { id: [storeA?.id, storeB?.id].filter(Boolean) },
    force: true
  })
})

describe('F-STOCK-3 transfer-send oversell + rollback', () => {
  // Races are timing-dependent: repeat the concurrent pair several rounds
  // (resetting stock each round) so a stale-read gate cannot hide behind
  // a lucky serialization. Every round must independently satisfy the
  // invariant.
  test('two concurrent 7-unit sends against stock 10 serialize to 201+400 with final stock 3', async () => {
    for (let round = 0; round < 10; round++) {
      await setSourceStock(10)
      const beforeCount = await transferCount()

      const [r1, r2] = await Promise.all([sendTransfer(7), sendTransfer(7)])
      expect([r1.status, r2.status].sort()).toEqual([201, 400])

      // Exactly one allocation committed: 10 - 7 = 3, never negative,
      // never 14 units promised.
      expect(await sourceStock()).toBe(3)
      expect(await transferCount()).toBe(beforeCount + 1)
    }
  })

  test('concurrent sends for the last unit serialize to 201+400 with final stock 0', async () => {
    for (let round = 0; round < 10; round++) {
      await setSourceStock(1)

      const [r1, r2] = await Promise.all([sendTransfer(1), sendTransfer(1)])
      expect([r1.status, r2.status].sort()).toEqual([201, 400])
      expect(await sourceStock()).toBe(0)
    }
  })

  test('failed send rolls back source stock and transfer rows completely', async () => {
    await setSourceStock(10)
    const stockBefore = await sourceStock()
    const countBefore = await transferCount()

    const res = await sendTransfer(999)
    expect(res.status).toBe(400)
    expect(await sourceStock()).toBe(stockBefore)
    expect(await transferCount()).toBe(countBefore)
  })
})
