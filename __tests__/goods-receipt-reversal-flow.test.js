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
let adminToken = null

beforeAll(async () => {
  location = await db.location.create({ name: 'GR_REV_STORE', status: 'active' })
  category = await db.category.create({ name: 'GR_REV_CATEGORY' })
  product = await db.product.create({
    nameProduct: 'GR_REV_PRODUCT',
    category: category.id,
    price: 8000,
    costPrice: 5000,
    stock: 0
  })
  adminToken = jwt.sign(
    { id: 7601, userName: 'admin_gr_rev', roleType: 'admin', store: location.id },
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

describe('Goods receipt edit — reverseStock uses the shared, locked, atomic-delta helper', () => {
  test('editing a draft receipt down to a smaller quantity reverses then reapplies correctly (net delta, not additive or lost)', async () => {
    const poRes = await request(app)
      .post('/purchase-order/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        store: location.id,
        status: 'ordered',
        items: [{ product: product.id, quantity: 10, price: 5000 }]
      })
    expect(poRes.status).toBe(201)
    const poItemId = poRes.body.data.items[0].id

    const beforeStock = await db.product.findByPk(product.id)

    const grRes = await request(app)
      .post('/goods-receipt/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        store: location.id,
        purchaseOrderId: poRes.body.data.id,
        status: 'draft',
        items: [
          {
            purchaseOrderItem: poItemId,
            product: product.id,
            qtyReceived: 10,
            price: 5000
          }
        ]
      })
    expect(grRes.status).toBe(201)

    const afterCreate = await db.product.findByPk(product.id)
    expect(afterCreate.stock).toBe(beforeStock.stock + 10)

    // Edit down to 6 — reverseStock(-10) then applyStock(+6) net effect
    // must be +6 total from the original baseline, not +16 (additive bug)
    // and not the original baseline unchanged (lost-update bug).
    const updateRes = await request(app)
      .put(`/goods-receipt/update/${grRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            purchaseOrderItem: poItemId,
            product: product.id,
            qtyReceived: 6,
            price: 5000
          }
        ]
      })
    expect(updateRes.status).toBe(200)

    const afterUpdate = await db.product.findByPk(product.id)
    expect(afterUpdate.stock).toBe(beforeStock.stock + 6)

    // The reversal's audit entry must reflect the LOCKED value it actually
    // reversed from, not a stale pre-transaction read.
    const history = await db.stock_history.findAll({
      where: { product: product.id, referenceType: 'adjustment' },
      order: [['id', 'ASC']]
    })
    expect(history.length).toBe(1)
    expect(history[0].quantityBefore).toBe(beforeStock.stock + 10)
    expect(history[0].quantityChange).toBe(-10)
    expect(history[0].quantityAfter).toBe(beforeStock.stock)
  })
})
