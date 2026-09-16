'use strict'
const db = require('../../db/models')

// F22-B10-02: Purchase Order fulfillment status was computed from gross
// `purchase_order_item.receivedQuantity` only, never adjusted for approved
// returns — a PO could stay 'received' after a return dropped its net
// fulfillment back below the ordered quantity. `receivedQuantity` itself
// stays an accumulated historical receiving total (unchanged, by design —
// see the comment in purchaseReturn.js approve()); this function computes
// fulfillment on top of it without ever decrementing it.
//
// Only `purchase_return` rows with status 'approved' are effective —
// pending/rejected returns must not affect fulfillment. Aggregation is
// per PO item (matched by the same product/ingredient/ingredientName key
// already used elsewhere in purchaseReturn.js), and a PO is only 'received'
// when EVERY item's net fulfillment meets its ordered quantity — one
// item's surplus never compensates another item's shortfall.
//
// Does not touch inventory, accounting, AP, tax, or the replacement-PO
// flow (F22-B10-01) — it only recomputes and persists purchase_order.status
// using the existing 'ordered'/'received' enum values, inside the
// transaction the caller already has open.
async function calculatePurchaseOrderFulfillmentStatus({
  purchaseOrderId,
  transaction
}) {
  const po = await db.purchase_order.findByPk(purchaseOrderId, {
    transaction
  })
  if (!po || po.status === 'cancelled') return po ? po.status : null

  const poItems = await db.purchase_order_item.findAll({
    where: { purchaseOrder: purchaseOrderId },
    transaction
  })
  if (poItems.length === 0) return po.status

  const itemKey = (row) =>
    row.ingredient
      ? `ing-${row.ingredient}`
      : row.product
        ? `prod-${row.product}`
        : row.ingredientName
          ? `name-${row.ingredientName}`
          : null

  const approvedReturns = await db.purchase_return.findAll({
    where: { purchaseOrder: purchaseOrderId, status: 'approved' },
    include: [{ model: db.purchase_return_item, as: 'items' }],
    transaction
  })

  const returnedByKey = {}
  for (const ret of approvedReturns) {
    for (const item of ret.items || []) {
      const key = itemKey(item)
      if (!key) continue
      returnedByKey[key] = (returnedByKey[key] || 0) + (Number(item.qty) || 0)
    }
  }

  const allFulfilled = poItems.every((pi) => {
    const key = itemKey(pi)
    const returned = key ? returnedByKey[key] || 0 : 0
    const netFulfilled = Math.max(
      0,
      (Number(pi.receivedQuantity) || 0) - returned
    )
    return netFulfilled >= Number(pi.quantity)
  })

  const nextStatus = allFulfilled ? 'received' : 'ordered'
  if (po.status !== nextStatus) {
    await po.update({ status: nextStatus }, { transaction })
  }
  return nextStatus
}

module.exports = {
  calculatePurchaseOrderFulfillmentStatus
}
