'use strict'
const db = require('../../../db/models')

const defaultColumns = [
  { key: 'name', label: 'Produk', type: 'string', width: 28, align: 'left' },
  { key: 'sold', label: 'Terjual', type: 'number', width: 14, align: 'right' },
  { key: 'revenue', label: 'Pendapatan', type: 'currency', width: 20, align: 'right' }
]
const totals = ['sold', 'revenue']
const filename = () => 'produk-terlaris'
const label = 'Produk Terlaris'

const getData = async (req) => {
  const userRole = req.user?.roleType
  const store =
    userRole === 'super_admin'
      ? req.storeId
      : req.storeId || req.query.store || req.cookies.store
  const { limit = 10 } = req.query

  const where = store ? { store } : {}

  const [bestSelling, , productRevenues] = await Promise.all([
    db.best_selling.findAll({
      where,
      order: [['totalSelling', 'DESC']],
      limit: parseInt(limit),
      attributes: ['productId', 'nameProduct', 'totalSelling', 'image']
    }),
    store
      ? db.sequelize.query(
          `SELECT COUNT(*)::int AS "count" FROM "product" p
           WHERE p."deletedAt" IS NULL AND p.status = 'active'
             AND EXISTS (
               SELECT 1 FROM "product_store" ps
               WHERE ps."product" = p."id" AND ps."store" = :store AND ps."deletedAt" IS NULL
             )`,
          { replacements: { store }, type: db.sequelize.QueryTypes.SELECT }
        )
      : db.product.count({ where: { status: 'active' } }),
    db.sequelize.query(
      `SELECT oi.product, COALESCE(SUM(oi."totalPrice"), 0) as revenue
       FROM order_item oi
       JOIN "order" o ON o.id = oi."order"
       WHERE o."paymentStatus" = 'paid'${store ? ' AND o.store = :store' : ''}
       GROUP BY oi.product`,
      {
        replacements: store ? { store } : {},
        type: db.sequelize.QueryTypes.SELECT
      }
    )
  ])

  const revenueMap = {}
  for (const r of productRevenues)
    revenueMap[Number(r.product)] = Number(r.revenue || 0)

  const rows = bestSelling.map((p) => ({
    id: p.productId,
    name: p.nameProduct,
    image: p.image,
    sold: Number(p.totalSelling || 0),
    revenue: revenueMap[Number(p.productId)] || 0
  }))

  return {
    rows,
    title: label,
    subtitle: `Limit: ${parseInt(limit)}` + (store ? ` - Toko: ${store}` : '')
  }
}

const archetype = 'ranking'
const layout = {"valueKey":"sold"}

module.exports = { getData, defaultColumns, totals, filename, label, archetype, layout }
