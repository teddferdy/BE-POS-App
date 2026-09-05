'use strict'

const db = require('../../db/models')

/**
 * Single authoritative path for mutating a product's stock (product.stock
 * + product_store_stock + stock_history), used by every feature that
 * changes stock outside the checkout-time sale/return-approval paths
 * (which have their own already-audited, already-tested locking).
 *
 * Before this existed, every caller (goods receipt, purchase return,
 * stock opname, ...) independently reimplemented the same ~15-line
 * "upsert product_store_stock + update product.stock + insert
 * stock_history" pattern, and the copies diverged in correctness — some
 * used an atomic SQL delta, others computed the new value in JS from an
 * unlocked read (a lost-update race under concurrent writers to the same
 * product), and some wrote an absolute value that could silently
 * overwrite a concurrent sale's decrement. This helper always locks the
 * product row first and always applies the change as an atomic SQL delta,
 * so every caller gets the same, correct concurrency guarantee.
 *
 * Callers MUST already be inside a transaction and pass it in — this
 * function does not open its own, since it's meant to be one step inside
 * a larger atomic operation (e.g. "reverse this whole goods receipt").
 */

/**
 * Adjust a product's stock by a signed delta.
 *
 * @param {object} params
 * @param {number} params.productId
 * @param {number|null} [params.store] - per-store shadow row updated only if provided
 * @param {number} params.deltaQty - signed; positive = increase, negative = decrease
 * @param {string} params.referenceType - stock_history.referenceType
 * @param {number|null} [params.referenceId]
 * @param {string|null} [params.notes]
 * @param {number|null} [params.createdBy]
 * @param {import('sequelize').Transaction} params.transaction - required
 * @param {boolean} [params.floorAtZero=true] - clamp the result at 0 instead of allowing negative
 * @returns {Promise<{product: object, quantityBefore: number, quantityAfter: number}|null>} null if delta is 0 or product not found
 */
async function adjustProductStock({
  productId,
  store = null,
  deltaQty,
  referenceType,
  referenceId = null,
  notes = null,
  createdBy = null,
  transaction,
  floorAtZero = true
}) {
  if (!transaction) {
    throw new Error('adjustProductStock requires an explicit transaction')
  }
  const qty = Math.trunc(Number(deltaQty)) || 0
  if (qty === 0) return null

  const product = await db.product.findByPk(productId, {
    transaction,
    lock: transaction.LOCK.UPDATE
  })
  if (!product) return null

  const quantityBefore = Number(product.stock) || 0
  const literal = floorAtZero
    ? `GREATEST(stock + (${qty}), 0)`
    : `stock + (${qty})`
  const quantityAfter = floorAtZero
    ? Math.max(quantityBefore + qty, 0)
    : quantityBefore + qty

  await product.update(
    { stock: db.sequelize.literal(literal) },
    { transaction }
  )
  product.stock = quantityAfter

  if (store) {
    // Seed a brand-new row with the product's own current baseline (not
    // 0) before applying the delta — stock opname is very often the
    // FIRST-EVER stock event for a given product/store pair (that's what
    // "count the physical stock and reconcile the system" means for a
    // store just being onboarded). Seeding at 0 would make the delta land
    // on the wrong absolute value the first time a per-store row is
    // created; seeding at the already-locked product baseline makes this
    // correct whether or not a row already existed.
    await db.sequelize.query(
      `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (product, store) DO NOTHING`,
      { bind: [productId, store, quantityBefore], transaction }
    )
    await db.product_store_stock.update(
      { stock: db.sequelize.literal(literal) },
      { where: { product: productId, store }, transaction }
    )
  }

  await db.stock_history.create(
    {
      product: productId,
      store,
      referenceType,
      referenceId,
      quantityBefore,
      quantityChange: qty,
      quantityAfter,
      unit: product.unit || 'pcs',
      notes,
      createdBy
    },
    { transaction }
  )

  return { product, quantityBefore, quantityAfter }
}

/**
 * Set a product's stock to an absolute counted value (e.g. stock opname).
 * The delta is computed against the freshly LOCKED live value, not
 * whatever value the caller last read (which could be from before the
 * lock, and stale by the time this commits) — so a concurrent sale's
 * atomic decrement landing between the physical count and this commit is
 * added on top of the count instead of being silently overwritten by it.
 *
 * @param {object} params - same as adjustProductStock, minus deltaQty, plus:
 * @param {number} params.newQty - the absolute target stock value
 */
async function setProductStock({
  productId,
  store = null,
  newQty,
  referenceType,
  referenceId = null,
  notes = null,
  createdBy = null,
  transaction
}) {
  if (!transaction) {
    throw new Error('setProductStock requires an explicit transaction')
  }
  const product = await db.product.findByPk(productId, {
    transaction,
    lock: transaction.LOCK.UPDATE
  })
  if (!product) return null

  const quantityBefore = Number(product.stock) || 0
  const target = Math.trunc(Number(newQty)) || 0
  const delta = target - quantityBefore
  if (delta === 0) return { product, quantityBefore, quantityAfter: quantityBefore }

  return adjustProductStock({
    productId,
    store,
    deltaQty: delta,
    referenceType,
    referenceId,
    notes,
    createdBy,
    transaction,
    floorAtZero: true
  })
}

module.exports = { adjustProductStock, setProductStock }
