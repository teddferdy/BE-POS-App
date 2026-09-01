'use strict'
const db = require('../../../db/models')

const defaultColumns = [
  { key: 'keterangan', label: 'Keterangan', type: 'string', width: 28, align: 'left' },
  { key: 'nominal', label: 'Nominal', type: 'currency', width: 22, align: 'right' }
]
const totals = []
const filename = () => 'arus-kas'
const label = 'Arus Kas'

const getData = async (req) => {
  const userRole = req.user?.roleType
  const store = userRole === 'super_admin' ? req.query.store : req.storeId || req.query.store
  const { startDate, endDate } = req.query
  const replacements = {}
  let txConditions = '1=1'

  if (store) { txConditions += ` AND o."store" = :store`; replacements.store = store }
  if (startDate) { txConditions += ` AND o."createdAt" >= :startDate`; replacements.startDate = new Date(startDate) }
  if (endDate) {
    const end = new Date(endDate); end.setHours(23, 59, 59, 999)
    txConditions += ` AND o."createdAt" <= :endDate`; replacements.endDate = end
  }

  const paymentRows = await db.sequelize.query(
    `SELECT t."typePayment", COALESCE(SUM(t."amount"), 0) as total
     FROM "transaction" t JOIN "order" o ON o.id = t."order"
     WHERE ${txConditions} GROUP BY t."typePayment"`,
    { replacements, type: db.sequelize.QueryTypes.SELECT }
  )

  let penerimaanTunai = 0, penerimaanQris = 0, penerimaanTransfer = 0, lainnya = 0
  for (const row of paymentRows) {
    const type = (row.typePayment || '').toLowerCase()
    const amount = Number(row.total || 0)
    if (type.includes('cash') || type === 'tunai' || type.includes('debit') || type.includes('credit') || type.includes('other') || type.includes('points')) penerimaanTunai += amount
    else if (type.includes('qris') || type.includes('e-wallet')) penerimaanQris += amount
    else if (type.includes('transfer')) penerimaanTransfer += amount
    else lainnya += amount
  }

  const expReplacements = {}
  let expConditions = `"status" = 'approved'`
  if (store) { expConditions += ` AND "store" = :store`; expReplacements.store = store }
  if (startDate) { expConditions += ` AND "date" >= :startDate`; expReplacements.startDate = replacements.startDate }
  if (endDate) { expConditions += ` AND "date" <= :endDate`; expReplacements.endDate = replacements.endDate }

  const [expAgg] = await db.sequelize.query(
    `SELECT COALESCE(SUM("amount"), 0) as total
     FROM expense WHERE ${expConditions}`,
    { replacements: expReplacements, type: db.sequelize.QueryTypes.SELECT }
  )

  const ppReplacements = {}
  let ppConditions = '1=1'
  if (store) { ppConditions += ` AND "store" = :store`; ppReplacements.store = store }
  if (startDate) { ppConditions += ` AND COALESCE("paymentDate", "createdAt") >= :startDate`; ppReplacements.startDate = replacements.startDate }
  if (endDate) { ppConditions += ` AND COALESCE("paymentDate", "createdAt") <= :endDate`; ppReplacements.endDate = replacements.endDate }

  const [ppAgg] = await db.sequelize.query(
    `SELECT COALESCE(SUM("amount"), 0) as total
     FROM purchase_payment WHERE ${ppConditions}`,
    { replacements: ppReplacements, type: db.sequelize.QueryTypes.SELECT }
  )
  const pengeluaranExpense = Number(expAgg.total || 0)
  const pengeluaranPurchasePayment = Number(ppAgg.total || 0)

  const refReplacements = {}
  let refConditions = `r."status" = 'approved' AND r."resolution" = 'credit'`
  if (store) { refConditions += ` AND r."store" = :store`; refReplacements.store = store }
  if (startDate) { refConditions += ` AND r."createdAt" >= :startDate`; refReplacements.startDate = replacements.startDate }
  if (endDate) { refConditions += ` AND r."createdAt" <= :endDate`; refReplacements.endDate = replacements.endDate }

  const [refAgg] = await db.sequelize.query(
    `SELECT COALESCE(SUM(ri."qty" * COALESCE((
       SELECT poi."price"
       FROM purchase_order_item poi
       WHERE poi."purchaseOrder" = r."purchaseOrder"
         AND (
           (ri."ingredient" IS NOT NULL AND poi."ingredient" = ri."ingredient")
           OR (ri."product" IS NOT NULL AND poi."product" = ri."product")
           OR (
             ri."ingredient" IS NULL AND ri."product" IS NULL
             AND poi."ingredientName" = ri."ingredientName"
           )
         )
       LIMIT 1
     ), 0)), 0) as total
     FROM purchase_return r
     INNER JOIN purchase_return_item ri ON ri."purchaseReturn" = r.id
     WHERE ${refConditions}`,
    { replacements: refReplacements, type: db.sequelize.QueryTypes.SELECT }
  )
  const penerimaanReturPembelian = Number(refAgg.total || 0)

  const totalPengeluaran = pengeluaranExpense + pengeluaranPurchasePayment
  const totalKasMasuk = penerimaanTunai + penerimaanQris + penerimaanTransfer + lainnya + penerimaanReturPembelian

  const rows = [
    { keterangan: 'Penerimaan Tunai', nominal: penerimaanTunai },
    { keterangan: 'Penerimaan QRIS', nominal: penerimaanQris },
    { keterangan: 'Penerimaan Transfer', nominal: penerimaanTransfer },
    { keterangan: 'Penerimaan Retur Pembelian', nominal: penerimaanReturPembelian },
    { keterangan: 'Pengeluaran Expense', nominal: pengeluaranExpense },
    { keterangan: 'Pengeluaran Purchase Payment', nominal: pengeluaranPurchasePayment }
  ]

  return {
    rows,
    title: label,
    subtitle: [startDate, endDate].filter(Boolean).join(' - ') || 'Periode'
  }
}

module.exports = { getData, defaultColumns, totals, filename, label }
