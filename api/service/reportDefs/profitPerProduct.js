'use strict'
const db = require('../../../db/models')

const defaultColumns = [
  { key: 'productName', label: 'Produk', type: 'string', width: 28, align: 'left' },
  { key: 'qtySold', label: 'Qty Terjual', type: 'number', width: 14, align: 'right' },
  { key: 'totalSales', label: 'Total Penjualan', type: 'currency', width: 20, align: 'right' },
  { key: 'totalHpp', label: 'HPP', type: 'currency', width: 20, align: 'right' },
  { key: 'profit', label: 'Laba', type: 'currency', width: 20, align: 'right' },
  { key: 'margin', label: 'Margin', type: 'percent', width: 12, align: 'right' }
]
const totals = ['qtySold', 'totalSales', 'totalHpp', 'profit']
const filename = () => 'laba-per-produk'
const label = 'Laba per Produk'

const getData = async (req) => {
  const { store, startDate, endDate } = req.query
  const replacements = {}
  let orderConditions = `o."paymentStatus" = 'paid'`

  if (store) {
    orderConditions += ` AND o."store" = :store`
    replacements.store = store
  }
  if (startDate) {
    orderConditions += ` AND o."createdAt" >= :startDate`
    replacements.startDate = new Date(startDate)
  } else {
    // No lower bound given — default to 90 days back instead of scanning
    // the full order/order_item history, which grows unbounded over the
    // life of the store.
    const defaultStart = endDate ? new Date(endDate) : new Date()
    defaultStart.setDate(defaultStart.getDate() - 90)
    orderConditions += ` AND o."createdAt" >= :startDate`
    replacements.startDate = defaultStart
  }
  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    orderConditions += ` AND o."createdAt" <= :endDate`
    replacements.endDate = end
  }

  const rows = await db.sequelize.query(
    `SELECT oi."product" as "productId",
            COALESCE(MAX(oi."productName"), 'Unknown') as "productName",
            COALESCE(SUM(oi."quantity"), 0) as "qtySold",
            COALESCE(SUM(oi."totalPrice"), 0) as "totalSales",
            COALESCE(SUM(COALESCE(oi."hppSnapshot", 0)), 0) as "totalHpp"
     FROM order_item oi
     JOIN "order" o ON o.id = oi."order"
     WHERE ${orderConditions}
     GROUP BY oi."product"
     ORDER BY (COALESCE(SUM(oi."totalPrice"), 0) - COALESCE(SUM(COALESCE(oi."hppSnapshot", 0)), 0)) DESC`,
    { replacements, type: db.sequelize.QueryTypes.SELECT }
  )

  const mapRows = rows.map((r) => {
    const totalSales = Number(r.totalSales || 0)
    const totalHpp = Number(r.totalHpp || 0)
    const profit = totalSales - totalHpp
    return {
      productId: r.productId,
      productName: r.productName,
      qtySold: Number(r.qtySold || 0),
      totalSales,
      totalHpp,
      profit,
      margin: totalSales > 0 ? Math.round((profit / totalSales) * 10000) / 100 : 0
    }
  })

  const subtitleParts = []
  if (startDate) subtitleParts.push(new Date(startDate).toLocaleDateString('id-ID'))
  if (endDate) subtitleParts.push(new Date(endDate).toLocaleDateString('id-ID'))
  if (store) subtitleParts.push(`Toko: ${store}`)

  return {
    rows: mapRows,
    title: label,
    subtitle: subtitleParts.join(' - ') || 'Periode'
  }
}

const archetype = 'ranking'
const layout = {"valueKey":"profit"}

module.exports = { getData, defaultColumns, totals, filename, label, archetype, layout }
