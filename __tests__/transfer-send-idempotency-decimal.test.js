process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 39 Batch 1 RED: transfer-send has no idempotencyKey handling and
// truncates fractional qty via Math.floor(). Every test below FAILS against
// the current implementation for those root causes:
// - keyed retries create duplicate transfers + duplicate deductions
// - fractional qty (1.5) is stored/deducted as 1

const SUFFIX = Date.now()

let storeA = null
let storeB = null
let product = null
let product2 = null
let adminTokenA = null
let adminTokenB = null

async function setSourceStock(prod, storeId, qty) {
  await db.product_store_stock.destroy({
    where: { product: prod.id, store: storeId },
    force: true
  })
  await db.product_store_stock.create({ product: prod.id, store: storeId, stock: qty })
  await db.product.update({ stock: 1000 }, { where: { id: prod.id } })
}

function sendTransfer(token, body) {
  return request(app)
    .post('/pos/transfer')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
}

function transferBody(fromStore, toStore, items, key, extra = {}) {
  return { fromStore, toStore, items, idempotencyKey: key, ...extra }
}

async function transferCount(where) {
  return db.stock_transfer.count({ where })
}

async function sourceStock(prod, storeId) {
  const row = await db.product_store_stock.findOne({
    where: { product: prod.id, store: storeId }
  })
  return Number(row?.stock)
}

beforeAll(async () => {
  storeA = await db.location.create({ name: `TRID_A_${SUFFIX}`, status: 'active' })
  storeB = await db.location.create({ name: `TRID_B_${SUFFIX}`, status: 'active' })
  const category = await db.category.create({ name: `TRID_CAT_${SUFFIX}` })
  product = await db.product.create({
    nameProduct: `TRID_P1_${SUFFIX}`,
    category: category.id,
    price: 4000,
    stock: 1000
  })
  product2 = await db.product.create({
    nameProduct: `TRID_P2_${SUFFIX}`,
    category: category.id,
    price: 5000,
    stock: 1000
  })
  const adminA = await db.user.create({
    userName: `admin_trid_a_${SUFFIX}`,
    email: `admin_trid_a_${SUFFIX}@test.com`,
    roleType: 'admin',
    userType: 'admin',
    store: storeA.id,
    status: 'active'
  })
  const adminB = await db.user.create({
    userName: `admin_trid_b_${SUFFIX}`,
    email: `admin_trid_b_${SUFFIX}@test.com`,
    roleType: 'admin',
    userType: 'admin',
    store: storeB.id,
    status: 'active'
  })
  adminTokenA = jwt.sign(
    { id: adminA.id, userName: adminA.userName, roleType: 'admin', store: storeA.id },
    JWT_SECRET
  )
  adminTokenB = jwt.sign(
    { id: adminB.id, userName: adminB.userName, roleType: 'admin', store: storeB.id },
    JWT_SECRET
  )
  await setSourceStock(product, storeA.id, 10)
  await setSourceStock(product2, storeA.id, 10)
  await setSourceStock(product, storeB.id, 10)
})

afterAll(async () => {
  await db.stock_history.destroy({
    where: { product: [product?.id, product2?.id].filter(Boolean) },
    force: true
  })
  await db.stock_transfer_item.destroy({ where: {}, force: true })
  await db.stock_transfer.destroy({
    where: { fromStore: [storeA?.id, storeB?.id].filter(Boolean) },
    force: true
  })
  await db.product_store_stock.destroy({
    where: { product: [product?.id, product2?.id].filter(Boolean) },
    force: true
  })
  await db.product.destroy({ where: { id: [product?.id, product2?.id].filter(Boolean) }, force: true })
  await db.category.destroy({ where: { name: `TRID_CAT_${SUFFIX}` }, force: true })
  await db.user.destroy({ where: { store: [storeA?.id, storeB?.id].filter(Boolean) }, force: true })
  await db.location.destroy({
    where: { id: [storeA?.id, storeB?.id].filter(Boolean) },
    force: true
  })
})

describe('Phase 39 Batch 1 — transfer send idempotency + exact decimal qty', () => {
  test('TEST 1 — same-key identical replay creates exactly one transfer and one deduction', async () => {
    await setSourceStock(product, storeA.id, 10)
    const key = `TRID-K1-${SUFFIX}`
    const body = transferBody(storeA.id, storeB.id, [{ productId: product.id, qty: 2 }], key)

    const first = await sendTransfer(adminTokenA, body)
    expect(first.status).toBe(201)
    const transferId = first.body.data.id
    expect(transferId).toBeDefined()

    const replay = await sendTransfer(adminTokenA, body)
    expect(replay.status).toBe(200)
    expect(replay.body.data.id).toBe(transferId)

    expect(await transferCount({ idempotencyKey: key })).toBe(1)
    expect(await sourceStock(product, storeA.id)).toBe(8)
  })

  test('TEST 2 — same-key different payload returns 409 with no mutation', async () => {
    await setSourceStock(product, storeA.id, 10)
    const key = `TRID-K2-${SUFFIX}`
    const first = await sendTransfer(
      adminTokenA,
      transferBody(storeA.id, storeB.id, [{ productId: product.id, qty: 2 }], key)
    )
    expect(first.status).toBe(201)

    const conflict = await sendTransfer(
      adminTokenA,
      transferBody(storeA.id, storeB.id, [{ productId: product.id, qty: 3 }], key)
    )
    expect(conflict.status).toBe(409)
    expect(await transferCount({ idempotencyKey: key })).toBe(1)
    expect(await sourceStock(product, storeA.id)).toBe(8)
  })

  test('TEST 3 — concurrent same-key sends mutate exactly once', async () => {
    await setSourceStock(product, storeA.id, 10)
    const key = `TRID-K3-${SUFFIX}`
    const body = transferBody(storeA.id, storeB.id, [{ productId: product.id, qty: 2 }], key)

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => sendTransfer(adminTokenA, body))
    )
    const created = results.filter((r) => r.status === 201)
    const replayed = results.filter((r) => r.status === 200)
    expect(created.length + replayed.length).toBe(5)
    expect(created.length).toBe(1)

    expect(await transferCount({ idempotencyKey: key })).toBe(1)
    expect(await sourceStock(product, storeA.id)).toBe(8)
  })

  test('TEST 4 — fractional qty 1.5 is stored and deducted exactly', async () => {
    await setSourceStock(product, storeA.id, 10)
    const key = `TRID-K4-${SUFFIX}`
    const res = await sendTransfer(
      adminTokenA,
      transferBody(storeA.id, storeB.id, [{ productId: product.id, qty: 1.5 }], key)
    )
    expect(res.status).toBe(201)

    const item = await db.stock_transfer_item.findOne({
      where: { stockTransfer: res.body.data.id }
    })
    expect(Number(item.qty)).toBe(1.5)
    expect(await sourceStock(product, storeA.id)).toBe(8.5)
  })

  test('TEST 5 — multiple fractional items each preserve exact qty', async () => {
    await setSourceStock(product, storeA.id, 10)
    await setSourceStock(product2, storeA.id, 10)
    const key = `TRID-K5-${SUFFIX}`
    const res = await sendTransfer(
      adminTokenA,
      transferBody(
        storeA.id,
        storeB.id,
        [
          { productId: product.id, qty: 0.25 },
          { productId: product2.id, qty: 2.125 }
        ],
        key
      )
    )
    expect(res.status).toBe(201)

    const items = await db.stock_transfer_item.findAll({
      where: { stockTransfer: res.body.data.id },
      order: [['product', 'ASC']]
    })
    expect(items.length).toBe(2)
    const byProduct = Object.fromEntries(items.map((r) => [r.product, Number(r.qty)]))
    expect(byProduct[product.id]).toBe(0.25)
    expect(byProduct[product2.id]).toBe(2.125)
    expect(await sourceStock(product, storeA.id)).toBe(9.75)
    expect(await sourceStock(product2, storeA.id)).toBe(7.875)
  })

  test('TEST 6 — failed keyed send does not poison the key and leaves no partial mutation', async () => {
    await setSourceStock(product, storeA.id, 10)
    const key = `TRID-K6-${SUFFIX}`
    const bad = await sendTransfer(
      adminTokenA,
      transferBody(storeA.id, storeB.id, [{ productId: 999999999, qty: 2 }], key)
    )
    expect(bad.status).toBeGreaterThanOrEqual(400)
    expect(await transferCount({ idempotencyKey: key })).toBe(0)
    expect(await sourceStock(product, storeA.id)).toBe(10)

    const good = await sendTransfer(
      adminTokenA,
      transferBody(storeA.id, storeB.id, [{ productId: product.id, qty: 2 }], key)
    )
    expect(good.status).toBe(201)
    expect(await transferCount({ idempotencyKey: key })).toBe(1)
    expect(await sourceStock(product, storeA.id)).toBe(8)
  })

  test('TEST 7 — same key from another store does not replay foreign transfer', async () => {
    await setSourceStock(product, storeA.id, 10)
    await setSourceStock(product, storeB.id, 10)
    const key = `TRID-K7-${SUFFIX}`
    const firstA = await sendTransfer(
      adminTokenA,
      transferBody(storeA.id, storeB.id, [{ productId: product.id, qty: 2 }], key)
    )
    expect(firstA.status).toBe(201)

    // Store B reuses the same key string with its own scope: must create its
    // own transfer, never replay store A's row.
    const fromB = await sendTransfer(
      adminTokenB,
      transferBody(storeB.id, storeA.id, [{ productId: product.id, qty: 1 }], key)
    )
    expect(fromB.status).toBe(201)
    expect(fromB.body.data.id).not.toBe(firstA.body.data.id)
    expect(await transferCount({ idempotencyKey: key })).toBe(2)
  })
})
