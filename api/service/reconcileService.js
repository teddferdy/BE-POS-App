'use strict'

const db = require('../../db/models')

const DIFF_QUERY = `
  SELECT p.id AS "productId",
         p."nameProduct" AS "nameProduct",
         p.stock AS "globalStock",
         COALESCE(s.sum_stock, 0) AS "perStoreTotal"
  FROM "product" p
  LEFT JOIN (
    SELECT "product", SUM(stock) AS sum_stock
    FROM "product_store_stock"
    WHERE "deletedAt" IS NULL
    GROUP BY "product"
  ) s ON s."product" = p.id
  WHERE p."deletedAt" IS NULL
`

const buildWhere = ({ storeId, productId }) => {
  const clauses = []
  const replacements = {}
  if (storeId) {
    clauses.push(
      'p.id IN (SELECT DISTINCT "product" FROM "product_store_stock" WHERE "store" = :storeId AND "deletedAt" IS NULL)'
    )
    replacements.storeId = storeId
  }
  if (productId) {
    clauses.push('p.id = :productId')
    replacements.productId = productId
  }
  return {
    clause: clauses.length ? ` AND ${clauses.join(' AND ')}` : '',
    replacements
  }
}

const getDiscrepancies = async ({
  storeId = null,
  productId = null,
  minDiff = 1
} = {}) => {
  const { clause, replacements } = buildWhere({ storeId, productId })
  const [rows] = await db.sequelize.query(
    `${DIFF_QUERY}${clause} ORDER BY ABS(p.stock - COALESCE(s.sum_stock, 0)) DESC`,
    { replacements }
  )

  return rows
    .map((r) => ({
      productId: Number(r.productId),
      nameProduct: r.nameProduct,
      globalStock: Number(r.globalStock) || 0,
      perStoreTotal: Number(r.perStoreTotal) || 0,
      diff: Math.abs(
        (Number(r.globalStock) || 0) - (Number(r.perStoreTotal) || 0)
      )
    }))
    .filter((r) => r.diff >= minDiff)
}

const getStoreRows = async (productId, storeId) => {
  const where = { product: productId }
  if (storeId) where.store = storeId
  return db.product_store_stock.findAll({ where, raw: true })
}

const logReconcile = async ({
  productId,
  storeId,
  quantityBefore,
  quantityAfter,
  notes,
  createdBy,
  transaction
}) => {
  await db.stock_history.create(
    {
      product: productId,
      store: storeId || null,
      referenceType: 'reconcile',
      referenceId: null,
      quantityBefore,
      quantityChange:
        (Number(quantityAfter) || 0) - (Number(quantityBefore) || 0),
      quantityAfter,
      unit: 'pcs',
      notes,
      createdBy: createdBy || null
    },
    { transaction }
  )
}

const reconcile = async ({
  direction = 'store-to-global',
  storeId = null,
  productId = null,
  createdBy = null
} = {}) => {
  const { clause, replacements } = buildWhere({ storeId, productId })
  const [rows] = await db.sequelize.query(`${DIFF_QUERY}${clause}`, {
    replacements
  })

  const changes = []
  await db.sequelize.transaction(async (t) => {
    for (const r of rows) {
      const pid = Number(r.productId)
      const globalStock = Number(r.globalStock) || 0
      const perStoreTotal = Number(r.perStoreTotal) || 0

      if (direction === 'store-to-global') {
        if (globalStock === perStoreTotal) continue
        const product = await db.product.findByPk(pid, { transaction: t })
        if (!product) continue
        await product.update({ stock: perStoreTotal }, { transaction: t })
        await logReconcile({
          productId: pid,
          storeId,
          quantityBefore: globalStock,
          quantityAfter: perStoreTotal,
          notes: `Rekon: product.stock ${globalStock} -> ${perStoreTotal} (sum per-store)`,
          createdBy,
          transaction: t
        })
        changes.push({
          productId: pid,
          field: 'product.stock',
          before: globalStock,
          after: perStoreTotal
        })
      } else {
        // global-to-store: distribute global stock across the product's store rows
        const rows2 = await getStoreRows(pid, null)
        if (rows2.length === 0) continue
        const allocated = rows2.map((s) => Number(s.stock) || 0)
        const sum = allocated.reduce((a, b) => a + b, 0)
        if (sum === globalStock) continue
        const base = Math.floor(globalStock / rows2.length)
        const remainder = globalStock - base * rows2.length
        for (let i = 0; i < rows2.length; i++) {
          const newStock = i === 0 ? base + remainder : base
          if (Number(rows2[i].stock) === newStock) continue
          await db.product_store_stock.update(
            { stock: newStock },
            { where: { id: rows2[i].id }, transaction: t }
          )
          await logReconcile({
            productId: pid,
            storeId: rows2[i].store,
            quantityBefore: Number(rows2[i].stock),
            quantityAfter: newStock,
            notes: `Rekon: stok toko ${rows2[i].store} ${rows2[i].stock} -> ${newStock} (distribusi global ${globalStock})`,
            createdBy,
            transaction: t
          })
          changes.push({
            productId: pid,
            store: rows2[i].store,
            field: 'product_store_stock.stock',
            before: Number(rows2[i].stock),
            after: newStock
          })
        }
      }
    }
  })

  return { direction, changes, total: changes.length }
}

module.exports = {
  getDiscrepancies,
  reconcile
}
