process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const { Op } = require('sequelize')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 39 Batch 3 (B1): reversing a Goods Receipt must also retire the
// product_batch / product_batch_stock rows its create path produced.
// Pre-fix, reverseStock unwinds product/ingredient stock but leaves the
// receipt's batches active, so FIFO and expiry write-off can later consume
// or write off phantom quantities.

const SUFFIX = Date.now()

let location = null
let category = null
let product = null
let adminToken = null

const makePO = async (price, qty = 10) => {
  const res = await request(app)
    .post('/purchase-order/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      store: location.id,
      status: 'ordered',
      items: [{ product: product.id, quantity: qty, price }]
    })
  if (res.status !== 201) throw new Error('PO setup failed: ' + JSON.stringify(res.body))
  return res.body.data
}

const makeDraftGR = async (po, qtyReceived = 10, extraItem = {}) => {
  const res = await request(app)
    .post('/goods-receipt/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      store: location.id,
      purchaseOrderId: po.id,
      status: 'draft',
      items: [
        {
          purchaseOrderItem: po.items[0].id,
          product: product.id,
          qtyReceived,
          price: 5000,
          ...extraItem
        }
      ]
    })
  if (res.status !== 201) throw new Error('GR setup failed: ' + JSON.stringify(res.body))
  return res.body.data
}

async function receiptBatches(receiptNumber) {
  return db.product_batch.findAll({
    where: {
      product: product.id,
      store: location.id,
      batchCode: { [Op.like]: `${receiptNumber}-%` }
    },
    order: [['id', 'ASC']]
  })
}

async function activeBatches() {
  return db.product_batch.findAll({
    where: { product: product.id, store: location.id, status: 'active' },
    order: [['id', 'ASC']]
  })
}

async function batchStocks(batchId) {
  return db.product_batch_stock.findAll({ where: { batch: batchId } })
}

async function fgStock() {
  return Number((await db.product.findByPk(product.id)).stock)
}

beforeAll(async () => {
  location = await db.location.create({ name: `GR_B1_STORE_${SUFFIX}`, status: 'active' })
  category = await db.category.create({ name: `GR_B1_CAT_${SUFFIX}` })
  product = await db.product.create({
    nameProduct: `GR_B1_PROD_${SUFFIX}`,
    category: category.id,
    price: 8000,
    costPrice: 5000,
    stock: 0
  })
  adminToken = jwt.sign(
    { id: 7901, userName: `admin_gr_b1_${SUFFIX}`, roleType: 'admin', store: location.id },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.product_batch_stock.destroy({ where: {}, force: true })
  await db.product_batch.destroy({ where: { product: product?.id }, force: true })
  await db.stock_history.destroy({ where: { product: product?.id }, force: true })
  await db.product_store_stock.destroy({ where: { product: product?.id }, force: true })
  await db.goodsReceiptItem.destroy({ where: {}, force: true })
  await db.goodsReceipt.destroy({ where: { store: location.id }, force: true })
  await db.purchase_order_item.destroy({ where: {}, force: true })
  await db.purchase_order.destroy({ where: { store: location.id }, force: true })
  await db.product.destroy({ where: { id: product?.id }, force: true })
  await db.category.destroy({ where: { id: category?.id }, force: true })
  await db.location.destroy({ where: { id: location?.id }, force: true })
})

describe('Phase 39 Batch 3 (B1) — GR reversal retires its product batches', () => {
  test('TEST 1 — cancel retires the receipt batches: no active batch, zeroed batch stock', async () => {
    const baseline = await fgStock()
    const po = await makePO(5000)
    const receipt = await makeDraftGR(po, 10)
    expect(await fgStock()).toBe(baseline + 10)

    const created = await receiptBatches(receipt.receiptNumber)
    expect(created).toHaveLength(1)
    expect(created[0].status).toBe('active')
    expect(Number(created[0].qty)).toBe(10)

    const cancelRes = await request(app)
      .patch(`/goods-receipt/status/${receipt.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
    expect(cancelRes.status).toBe(200)
    expect(await fgStock()).toBe(baseline)

    // The receipt's batch must no longer be consumable by FIFO/expiry.
    expect(await activeBatches()).toHaveLength(0)
    const retired = await receiptBatches(receipt.receiptNumber)
    expect(retired).toHaveLength(1)
    expect(retired[0].status).not.toBe('active')
    for (const b of retired) {
      for (const s of await batchStocks(b.id)) {
        expect(Number(s.quantity)).toBe(0)
      }
    }
  })

  test('TEST 2 — update with replacement voids old batches and creates current ones', async () => {
    const baseline = await fgStock()
    const po = await makePO(5000)
    const receipt = await makeDraftGR(po, 10)

    const updateRes = await request(app)
      .put(`/goods-receipt/update/${receipt.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        // NOTE: status must be explicit — updateGoodsReceiptSchema inherits
        // create's `.default('completed')`, so an omitted status completes
        // the receipt (which is itself a J1 journal-posting transition).
        status: 'draft',
        items: [
          {
            purchaseOrderItem: po.items[0].id,
            product: product.id,
            qtyReceived: 6,
            price: 5000
          }
        ]
      })
    expect(updateRes.status).toBe(200)
    expect(await fgStock()).toBe(baseline + 6)

    // Old 10-unit batch retired; exactly one active batch carrying 6.
    const all = await receiptBatches(receipt.receiptNumber)
    const active = all.filter((b) => b.status === 'active')
    expect(active).toHaveLength(1)
    expect(Number(active[0].qty)).toBe(6)
    const retired = all.filter((b) => b.status !== 'active')
    expect(retired).toHaveLength(1)
    expect(Number(retired[0].qty)).toBe(10)

    // Close the lifecycle: cancelling the replaced receipt unwinds the
    // re-applied effect and retires the replacement batch.
    const cancelRes = await request(app)
      .patch(`/goods-receipt/status/${receipt.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
    expect(cancelRes.status).toBe(200)
    expect(await fgStock()).toBe(baseline)
    expect(await activeBatches()).toHaveLength(0)
  })

  test('TEST 3 — delete retires the receipt batches', async () => {
    const baseline = await fgStock()
    const po = await makePO(5000)
    const receipt = await makeDraftGR(po, 10)

    const delRes = await request(app)
      .delete(`/goods-receipt/delete/${receipt.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(delRes.status).toBe(200)
    expect(await fgStock()).toBe(baseline)
    expect(await activeBatches()).toHaveLength(0)
    const retired = await receiptBatches(receipt.receiptNumber)
    expect(retired).toHaveLength(1)
    expect(retired[0].status).not.toBe('active')
  })

  test('TEST 4 — cancelling one receipt never touches another receipt batch', async () => {
    const po = await makePO(5000, 20)
    const receiptA = await makeDraftGR(po, 10, { batchNumber: `B1-LOT-A-${SUFFIX}` })
    const receiptB = await makeDraftGR(po, 10, { batchNumber: `B1-LOT-B-${SUFFIX}` })

    const cancelRes = await request(app)
      .patch(`/goods-receipt/status/${receiptA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
    expect(cancelRes.status).toBe(200)

    const batchA = await db.product_batch.findAll({
      where: { product: product.id, store: location.id, batchCode: `B1-LOT-A-${SUFFIX}` }
    })
    expect(batchA).toHaveLength(1)
    expect(batchA[0].status).not.toBe('active')

    const batchB = await db.product_batch.findAll({
      where: { product: product.id, store: location.id, batchCode: `B1-LOT-B-${SUFFIX}` }
    })
    expect(batchB).toHaveLength(1)
    expect(batchB[0].status).toBe('active')
    expect(Number(batchB[0].qty)).toBe(10)

    // Cleanup the surviving receipt through its own lifecycle.
    const cancelB = await request(app)
      .patch(`/goods-receipt/status/${receiptB.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
    expect(cancelB.status).toBe(200)
  })

  test('TEST 5 — repeated cancel is rejected and cannot double-void batches', async () => {
    const po = await makePO(5000)
    const receipt = await makeDraftGR(po, 10)

    const first = await request(app)
      .patch(`/goods-receipt/status/${receipt.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
    expect(first.status).toBe(200)
    const afterFirst = await receiptBatches(receipt.receiptNumber)

    const second = await request(app)
      .patch(`/goods-receipt/status/${receipt.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
    expect(second.status).toBe(400)

    const afterSecond = await receiptBatches(receipt.receiptNumber)
    expect(afterSecond.map((b) => [b.id, b.status, Number(b.qty)])).toEqual(
      afterFirst.map((b) => [b.id, b.status, Number(b.qty)])
    )
  })
})
