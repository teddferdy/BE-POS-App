'use strict'

const db = require('../../db/models')
const { Op } = require('sequelize')

const DEFAULT_EXPIRY = '2099-12-31'

const toDateOnly = (d) => {
  if (!d) return null
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return null
  return dt.toISOString().slice(0, 10)
}

// Create a product_batch + per-store product_batch_stock on a stock-in event
// (e.g. goods receipt). Each receipt line becomes one batch so FIFO allocation
// and expiry tracking work.
async function addBatchStock({
  productId,
  store,
  qty,
  costPerUnit = 0,
  batchCode = null,
  expiryDate = null,
  supplier = null,
  receivedDate = null,
  transaction
}) {
  if (!productId || !store) return null
  const qtyInt = Math.floor(Number(qty) || 0)
  if (qtyInt <= 0) return null

  const code = batchCode || `BAT-${productId}-${Date.now()}`
  const expiry = toDateOnly(expiryDate) || DEFAULT_EXPIRY
  const received = toDateOnly(receivedDate) || toDateOnly(new Date())

  const batch = await db.product_batch.create(
    {
      product: productId,
      batchCode: code,
      expiryDate: expiry,
      qty: qtyInt,
      store,
      status: 'active',
      received_date: received,
      received_quantity: qtyInt,
      cost_per_unit: Math.round(Number(costPerUnit) || 0),
      supplier: supplier || null
    },
    { transaction }
  )

  await db.product_batch_stock.create(
    {
      batch: batch.id,
      store,
      quantity: qtyInt,
      reserved_quantity: 0,
      allocated_quantity: 0,
      unit_cost: Number(costPerUnit) || 0
    },
    { transaction }
  )

  return batch
}

// Deduct qty from per-store batches using FIFO (oldest received_date first).
// Returns the quantity successfully allocated from batches (may be less than
// qty when a product predates batch tracking).
async function deductFifo({ productId, store, qty, transaction }) {
  const qtyInt = Math.floor(Number(qty) || 0)
  if (qtyInt <= 0 || !productId || !store) return 0

  const batches = await db.product_batch.findAll({
    where: { product: productId, store, status: 'active' },
    order: [
      ['received_date', 'ASC'],
      ['expiryDate', 'ASC'],
      ['id', 'ASC']
    ],
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    transaction
  })
  if (batches.length === 0) return 0

  const stocks = await db.product_batch_stock.findAll({
    where: { batch: { [Op.in]: batches.map((b) => b.id) }, store },
    transaction
  })
  const stockByBatch = new Map(stocks.map((s) => [Number(s.batch), s]))

  let remaining = qtyInt
  for (const batch of batches) {
    if (remaining <= 0) break
    const bs = stockByBatch.get(Number(batch.id))
    if (!bs || Number(bs.quantity) <= 0) continue

    const available = Number(bs.quantity)
    const deduct = Math.min(remaining, available)
    await bs.update(
      { quantity: db.sequelize.literal(`quantity - ${deduct}`) },
      { transaction }
    )
    remaining -= deduct

    if (available - deduct <= 0) {
      await batch.update({ status: 'consumed' }, { transaction })
    }
  }

  return qtyInt - remaining
}

// Mark expired batches (expiryDate < today) as 'expired' and write off their
// remaining qty from product.stock + product_store_stock. Returns a summary.
async function writeOffExpired({
  storeId = null,
  productId = null,
  createdBy = null
} = {}) {
  const today = toDateOnly(new Date())
  const where = {
    status: 'active',
    expiryDate: { [Op.lt]: today }
  }
  if (storeId) where.store = storeId
  if (productId) where.product = productId

  const summary = { total: 0, affected: [] }
  await db.sequelize.transaction(async (t) => {
    const batches = await db.product_batch.findAll({
      where,
      lock: t.LOCK.UPDATE,
      transaction: t
    })
    const stockRows = await db.product_batch_stock.findAll({
      where: { batch: { [Op.in]: batches.map((b) => b.id) } },
      transaction: t
    })
    const stockByBatch = new Map(stockRows.map((s) => [Number(s.batch), s]))

    for (const batch of batches) {
      const bs = stockByBatch.get(Number(batch.id))
      const qty = bs ? Number(bs.quantity) || 0 : Number(batch.qty) || 0
      if (qty <= 0) continue

      const product = await db.product.findByPk(batch.product, { transaction: t })
      if (!product) continue

      const oldStock = Number(product.stock) || 0
      await product.update(
        { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
        { transaction: t }
      )

      await db.sequelize.query(
        `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
         VALUES ($1, $2, 0, NOW(), NOW())
         ON CONFLICT (product, store) DO NOTHING`,
        { bind: [batch.product, batch.store], transaction: t }
      )
      await db.product_store_stock.update(
        { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
        { where: { product: batch.product, store: batch.store }, transaction: t }
      )

      if (bs) {
        await bs.update({ quantity: 0 }, { transaction: t })
      }
      await batch.update({ status: 'expired' }, { transaction: t })

      await db.stock_history.create(
        {
          product: batch.product,
          store: batch.store,
          referenceType: 'writeoff',
          referenceId: batch.id,
          quantityBefore: oldStock,
          quantityChange: -qty,
          quantityAfter: Math.max(oldStock - qty, 0),
          unit: product.unit || 'pcs',
          notes: `Write-off batch ${batch.batchCode} (expired ${batch.expiryDate})`,
          createdBy: createdBy || null
        },
        { transaction: t }
      )

      summary.total += qty
      summary.affected.push({
        batchId: batch.id,
        batchCode: batch.batchCode,
        product: batch.product,
        store: batch.store,
        qty
      })
    }
  })

  return summary
}

module.exports = { addBatchStock, deductFifo, writeOffExpired }
