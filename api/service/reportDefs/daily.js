'use strict'
const db = require('../../../db/models')

const defaultColumns = [
  { key: 'tanggal', label: 'Tanggal', type: 'date', width: 14, align: 'left' },
  { key: 'totalTransaksi', label: 'Total Transaksi', type: 'number', width: 16, align: 'right' },
  { key: 'totalPenjualanBersih', label: 'Total Penjualan', type: 'currency', width: 20, align: 'right' },
  { key: 'totalHpp', label: 'HPP', type: 'currency', width: 20, align: 'right' },
  { key: 'foodCostPersen', label: 'Food Cost', type: 'percent', width: 12, align: 'right' },
  { key: 'grossProfit', label: 'Laba Kotor', type: 'currency', width: 20, align: 'right' },
  { key: 'netProfit', label: 'Laba Bersih', type: 'currency', width: 20, align: 'right' },
  { key: 'totalCovers', label: 'Covers', type: 'number', width: 12, align: 'right' }
]

const totals = ['totalTransaksi', 'totalPenjualanBersih', 'totalHpp', 'grossProfit', 'netProfit', 'totalCovers']

const filename = () => 'laporan-harian'

const label = 'Laporan Harian'

const archetype = 'summary'
const layout = {
  kpis: ['totalTransaksi', 'totalPenjualanBersih', 'grossProfit', 'netProfit']
}

const getData = async (req) => {
  const { store, startDate, endDate } = req.query
  const replacements = {}
  let orderConditions = `"paymentStatus" = 'paid'`

  if (store) {
    orderConditions += ` AND o."store" = :store`
    replacements.store = store
  }
  if (startDate) {
    orderConditions += ` AND o."createdAt" >= :startDate`
    replacements.startDate = new Date(startDate)
  }
  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    orderConditions += ` AND o."createdAt" <= :endDate`
    replacements.endDate = end
  }

  const dailyOrders = await db.sequelize.query(
    `SELECT DATE(o."createdAt") as tanggal,
            COUNT(*) as "totalTransaksi",
            COALESCE(SUM(o."totalPrice"), 0) as "totalPenjualan",
            COALESCE(SUM(o."discountAmount"), 0) as "totalDiscount",
            COALESCE(SUM(o."totalQuantity"), 0) as "totalQty",
            COALESCE(SUM(o."totalCovers"), 0) as "totalCovers"
     FROM "order" o
     WHERE ${orderConditions}
     GROUP BY DATE(o."createdAt")
     ORDER BY tanggal DESC`,
    { replacements, type: db.sequelize.QueryTypes.SELECT }
  )

  const rows = []
  if (dailyOrders.length) {
    const dailyHpp = await db.sequelize.query(
      `SELECT DATE(o."createdAt") as tanggal,
              COALESCE(SUM(COALESCE(oi."hppSnapshot", oi."price", 0)), 0) as "totalHpp"
       FROM order_item oi
       JOIN "order" o ON o.id = oi."order"
       WHERE ${orderConditions}
       GROUP BY DATE(o."createdAt")`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )
    const hppMap = {}
    for (const row of dailyHpp) hppMap[row.tanggal] = Number(row.totalHpp || 0)

    let expenseConditions = `"status" = 'approved'`
    const expReplacements = {}
    if (store) { expenseConditions += ` AND "store" = :store`; expReplacements.store = store }
    if (startDate) { expenseConditions += ` AND "date" >= :startDate`; expReplacements.startDate = replacements.startDate }
    if (endDate) { expenseConditions += ` AND "date" <= :endDate`; expReplacements.endDate = replacements.endDate }

    let dailyExpenses = []
    if (startDate || endDate || store) {
      dailyExpenses = await db.sequelize.query(
        `SELECT DATE("date") as tanggal, COALESCE(SUM("amount"), 0) as "totalExpense"
         FROM expense
         WHERE ${expenseConditions}
         GROUP BY DATE("date")`,
        { replacements: expReplacements, type: db.sequelize.QueryTypes.SELECT }
      )
    }
    const expenseMap = {}
    for (const row of dailyExpenses) expenseMap[row.tanggal] = Number(row.totalExpense || 0)

    // F4: refund impact, sourced directly from approved sales_return rows
    // — the same figure the sales-return GL journal already posts
    // (accountingService.postSalesReturnJournal) — never inferred from
    // order.paymentStatus, which cannot be trusted for this purpose (see
    // the cashRegister.js cash-ledger fix for why). Grouped by the
    // return's own approval date, independent of the underlying order's
    // current status.
    let refundConditions = `sr.status = 'approved' AND sr."approvedAt" IS NOT NULL`
    const refundReplacements = {}
    if (store) { refundConditions += ` AND sr."store" = :store`; refundReplacements.store = store }
    if (startDate) { refundConditions += ` AND sr."approvedAt" >= :startDate`; refundReplacements.startDate = replacements.startDate }
    if (endDate) { refundConditions += ` AND sr."approvedAt" <= :endDate`; refundReplacements.endDate = replacements.endDate }

    const dailyRefunds = await db.sequelize.query(
      `SELECT DATE(sr."approvedAt") as tanggal, COALESCE(SUM(sr."refundAmount"), 0) as "totalRefund"
       FROM sales_return sr
       WHERE ${refundConditions}
       GROUP BY DATE(sr."approvedAt")`,
      { replacements: refundReplacements, type: db.sequelize.QueryTypes.SELECT }
    )
    const refundMap = {}
    for (const row of dailyRefunds) refundMap[row.tanggal] = Number(row.totalRefund || 0)

    for (const row of dailyOrders) {
      const tanggal = row.tanggal
      const totalPenjualan = Number(row.totalPenjualan || 0)
      const totalDiscount = Number(row.totalDiscount || 0)
      const totalRefund = refundMap[tanggal] || 0
      const netRevenue = totalPenjualan - totalDiscount - totalRefund
      const totalHpp = hppMap[tanggal] || 0
      const totalExpense = expenseMap[tanggal] || 0
      const grossProfit = netRevenue - totalHpp
      const netProfit = grossProfit - totalExpense
      const foodCostPersen = totalPenjualan > 0 ? Math.round((totalHpp / totalPenjualan) * 10000) / 100 : 0
      rows.push({
        tanggal,
        totalTransaksi: Number(row.totalTransaksi || 0),
        totalPenjualanBersih: netRevenue,
        totalRefund,
        totalHpp,
        foodCostPersen,
        grossProfit,
        netProfit,
        totalCovers: Number(row.totalCovers || 0) || Number(row.totalQty || 0)
      })
    }
  }

  const subtitleParts = []
  if (startDate) subtitleParts.push(new Date(startDate).toLocaleDateString('id-ID'))
  if (endDate) subtitleParts.push(new Date(endDate).toLocaleDateString('id-ID'))
  if (store) subtitleParts.push(`Toko: ${store}`)

  return {
    rows,
    title: label,
    subtitle: subtitleParts.join(' - ') || new Date().toLocaleDateString('id-ID')
  }
}

module.exports = { getData, defaultColumns, totals, filename, label, archetype, layout }
