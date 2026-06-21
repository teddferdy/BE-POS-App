require('dotenv').config({ path: __dirname + '/.env' })
const db = require('./db/models/index')

async function main() {
  await db.sequelize.authenticate()
  console.log('Connected\n')

  const now = new Date()
  const done = []

  // 1. ingredient_category
  try {
    await db.ingredientCategory.bulkCreate([
      { name: 'Kat Bahan Draft', status: 'draft', createdAt: now, updatedAt: now },
      { name: 'Kat Bahan Aktif', status: 'active', createdAt: now, updatedAt: now },
      { name: 'Kat Bahan Non-Aktif', status: 'inactive', createdAt: now, updatedAt: now },
    ])
    done.push('ingredient_category')
  } catch (e) { done.push(`ingredient_category FAIL: ${e.message}`) }

  // 2. ingredient
  try {
    await db.ingredient.bulkCreate([
      { name: 'Bahan Draft', status: 'draft', createdAt: now, updatedAt: now },
      { name: 'Bahan Aktif', status: 'active', createdAt: now, updatedAt: now },
      { name: 'Bahan Non-Aktif', status: 'inactive', createdAt: now, updatedAt: now },
    ])
    done.push('ingredient')
  } catch (e) { done.push(`ingredient FAIL: ${e.message}`) }

  // 3. purchase_order (ENUM: pending/ordered/received/cancelled)
  try {
    const supp = await db.supplier.findOne({ where: { deletedAt: null } })
    const sid = supp?.id || 1
    await db.purchase_order.bulkCreate([
      { orderNumber: 'PO-DRAFT-2', supplier: sid, status: 'pending', orderDate: now, createdAt: now, updatedAt: now },
      { orderNumber: 'PO-ORDERED-2', supplier: sid, status: 'ordered', orderDate: now, createdAt: now, updatedAt: now },
      { orderNumber: 'PO-RECEIVED-2', supplier: sid, status: 'received', orderDate: now, createdAt: now, updatedAt: now },
    ])
    done.push('purchase_order')
  } catch (e) { done.push(`purchase_order FAIL: ${e.message}`) }

  // 4. discount
  try {
    await db.discount.bulkCreate([
      { name: 'Diskon Draft', type: 'percent', value: 5, status: 'draft', code: 'DRAFT6', createdAt: now, updatedAt: now },
      { name: 'Diskon Aktif', type: 'percent', value: 10, status: 'active', code: 'AKTIF11', createdAt: now, updatedAt: now },
      { name: 'Diskon Non-Aktif', type: 'percent', value: 15, status: 'inactive', code: 'NON16', createdAt: now, updatedAt: now },
    ])
    done.push('discount')
  } catch (e) { done.push(`discount FAIL: ${e.message}`) }

  // 5. stock_opname (ENUM: draft/completed/cancelled)
  try {
    await db.stockOpname.bulkCreate([
      { opnameNumber: 'SO-DRAFT-1', date: now, status: 'draft', createdAt: now, updatedAt: now },
      { opnameNumber: 'SO-COMPLETE-1', date: now, status: 'completed', createdAt: now, updatedAt: now },
      { opnameNumber: 'SO-CANCELLED-1', date: now, status: 'cancelled', createdAt: now, updatedAt: now },
    ])
    done.push('stock_opname')
  } catch (e) { done.push(`stock_opname FAIL: ${e.message}`) }

  // 6. production_order (ENUM: draft/planned/in_progress/completed/cancelled)
  try {
    const prod = await db.product.findOne({ where: { deletedAt: null } })
    const pid = prod?.id || 1
    await db.productionOrder.bulkCreate([
      { productionNo: 'PO-DRAFT-1', productItemId: pid, plannedQty: 10, status: 'draft', createdAt: now, updatedAt: now },
      { productionNo: 'PO-PLANNED-1', productItemId: pid, plannedQty: 20, status: 'planned', createdAt: now, updatedAt: now },
      { productionNo: 'PO-COMPLETE-1', productItemId: pid, plannedQty: 30, status: 'completed', createdAt: now, updatedAt: now },
    ])
    done.push('production_order')
  } catch (e) { done.push(`production_order FAIL: ${e.message}`) }

  // 7. goods_receipt (ENUM: draft/completed/cancelled)
  try {
    const po = await db.purchase_order.findOne({ where: { deletedAt: null } })
    const poid = po?.id || 1
    await db.goodsReceipt.bulkCreate([
      { receiptNumber: 'GR-DRAFT-2', purchaseOrderId: poid, receivedDate: now, status: 'draft', createdAt: now, updatedAt: now },
      { receiptNumber: 'GR-COMPLETE-2', purchaseOrderId: poid, receivedDate: now, status: 'completed', createdAt: now, updatedAt: now },
      { receiptNumber: 'GR-CANCELLED-2', purchaseOrderId: poid, receivedDate: now, status: 'cancelled', createdAt: now, updatedAt: now },
    ])
    done.push('goods_receipt')
  } catch (e) { done.push(`goods_receipt FAIL: ${e.message}`) }

  // 8. expense_category
  try {
    await db.expense_category.bulkCreate([
      { name: 'Kat Biaya Draft', status: 'draft', createdAt: now, updatedAt: now },
      { name: 'Kat Biaya Aktif', status: 'active', createdAt: now, updatedAt: now },
      { name: 'Kat Biaya Non-Aktif', status: 'inactive', createdAt: now, updatedAt: now },
    ])
    done.push('expense_category')
  } catch (e) { done.push(`expense_category FAIL: ${e.message}`) }

  // 9. expense (ENUM: pending/approved/rejected)
  try {
    const ec = await db.expense_category.findOne({ where: { deletedAt: null } })
    const ecid = ec?.id || 1
    await db.expense.bulkCreate([
      { expenseNumber: 'EXP-DRAFT-1', category: ecid, amount: 50000, date: now, status: 'pending', createdAt: now, updatedAt: now },
      { expenseNumber: 'EXP-APPROVED-1', category: ecid, amount: 100000, date: now, status: 'approved', createdAt: now, updatedAt: now },
      { expenseNumber: 'EXP-REJECTED-1', category: ecid, amount: 75000, date: now, status: 'rejected', createdAt: now, updatedAt: now },
    ])
    done.push('expense')
  } catch (e) { done.push(`expense FAIL: ${e.message}`) }

  // 10. tax_config
  try {
    await db.taxConfig.bulkCreate([
      { name: 'Pajak Draft', rate: 5, status: 'draft', createdAt: now, updatedAt: now },
      { name: 'Pajak Aktif', rate: 11, status: 'active', createdAt: now, updatedAt: now },
      { name: 'Pajak Non-Aktif', rate: 0, status: 'inactive', createdAt: now, updatedAt: now },
    ])
    done.push('tax_config')
  } catch (e) { done.push(`tax_config FAIL: ${e.message}`) }

  // 11. type_payment
  try {
    await db.type_payment.bulkCreate([
      { name: 'Pembayaran Draft', type: 'cash', status: 'draft', createdAt: now, updatedAt: now },
      { name: 'Pembayaran Aktif', type: 'cash', status: 'active', createdAt: now, updatedAt: now },
      { name: 'Pembayaran Non-Aktif', type: 'cash', status: 'inactive', createdAt: now, updatedAt: now },
    ])
    done.push('type_payment')
  } catch (e) { done.push(`type_payment FAIL: ${e.message}`) }

  // 12. role
  try {
    await db.role.bulkCreate([
      { name: 'Role Draft', roleType: 'user', status: 'draft', createdAt: now, updatedAt: now },
      { name: 'Role Aktif', roleType: 'user', status: 'active', createdAt: now, updatedAt: now },
      { name: 'Role Non-Aktif', roleType: 'user', status: 'inactive', createdAt: now, updatedAt: now },
    ])
    done.push('role')
  } catch (e) { done.push(`role FAIL: ${e.message}`) }

  console.log('--- Results ---')
  done.forEach(r => console.log(r))
  console.log('\nDone!')
  await db.sequelize.close()
}

main().catch(e => { console.error(e); process.exit(1) })
