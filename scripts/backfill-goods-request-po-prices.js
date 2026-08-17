// One-off backfill: set prices on existing DRAFT purchase orders created from goods requests.
// Price is resolved from supplier_product catalog (by productId, then by name), matching the
// logic in api/controller/goodsRequest.js approve flow.
// Run: node scripts/backfill-goods-request-po-prices.js
const db = require('../db/models')
const { Op } = require('sequelize')

const main = async () => {
  const where = {
    status: 'draft',
    [Op.and]: db.sequelize.literal(
      'EXISTS (SELECT 1 FROM goods_request gr WHERE gr."purchaseOrderId" = "purchase_order"."id" AND gr."deletedAt" IS NULL)'
    )
  }

  const pos = await db.purchase_order.findAll({ where })
  console.log(`Found ${pos.length} draft PO(s) sourced from goods requests`)

  if (pos.length === 0) return

  const poIds = pos.map((p) => p.id)

  const itemsByPo = {}
  const allItems = await db.purchase_order_item.findAll({
    where: { purchaseOrder: { [Op.in]: poIds } }
  })
  for (const it of allItems) {
    if (!itemsByPo[it.purchaseOrder]) itemsByPo[it.purchaseOrder] = []
    itemsByPo[it.purchaseOrder].push(it)
  }

  const supplierIds = [
    ...new Set(allItems.map((it) => it.supplier).filter(Boolean))
  ]
  let priceByProduct = {}
  let priceByName = {}
  if (supplierIds.length > 0) {
    const catalog = await db.supplier_product.findAll({
      where: { supplier: { [Op.in]: supplierIds } },
      attributes: ['supplier', 'productId', 'name', 'price', 'lastPrice']
    })
    priceByProduct = {}
    priceByName = {}
    for (const cp of catalog) {
      const price = Number(cp.price || cp.lastPrice || 0)
      if (cp.productId) {
        const key = `${cp.supplier}:${cp.productId}`
        if (!(key in priceByProduct)) priceByProduct[key] = price
      }
      const nameKey = String(cp.name || '')
        .toLowerCase()
        .trim()
      if (nameKey) {
        const key = `${cp.supplier}:${nameKey}`
        if (!(key in priceByName)) priceByName[key] = price
      }
    }
  }

  const resolvePrice = (item) => {
    if (!item.supplier) return 0
    if (item.product) {
      const byProduct = priceByProduct[`${item.supplier}:${item.product}`]
      if (byProduct) return byProduct
    }
    const itemName = String(item.ingredientName || '')
      .toLowerCase()
      .trim()
    if (itemName) {
      const byName = priceByName[`${item.supplier}:${itemName}`]
      if (byName) return byName
    }
    return 0
  }

  const transaction = await db.sequelize.transaction()
  let updatedItems = 0
  let updatedPos = 0

  try {
    for (const po of pos) {
      const items = itemsByPo[po.id] || []
      let changed = false
      let totalAmount = 0

      for (const item of items) {
        const price = resolvePrice(item)
        if (price > 0 && Number(item.price) !== price) {
          item.price = price
          changed = true
        }
        if (
          Number(item.total) !==
          Number(item.quantity || 0) * Number(item.price)
        ) {
          item.total = Number(item.quantity || 0) * Number(item.price)
          changed = true
        }
        totalAmount += Number(item.total || 0)
      }

      if (changed) {
        for (const item of items) {
          await item.update(
            { price: item.price, total: item.total },
            { transaction }
          )
          updatedItems++
        }
        await po.update(
          {
            totalAmount,
            finalAmount: totalAmount,
            discount: 0,
            additionalCost: 0
          },
          { transaction }
        )
        updatedPos++
        console.log(
          `PO ${po.orderNumber || po.id}: totalAmount = ${totalAmount} (${items.length} items)`
        )
      }
    }

    await transaction.commit()
    console.log(`Done. Updated ${updatedPos} PO(s), ${updatedItems} item(s).`)
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
