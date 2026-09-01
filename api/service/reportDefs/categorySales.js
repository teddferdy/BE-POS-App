'use strict'
const db = require('../../../db/models')
const { Op } = require('sequelize')

const defaultColumns = [
  { key: 'category', label: 'Kategori', type: 'string', width: 24, align: 'left' },
  { key: 'quantitySold', label: 'Qty Terjual', type: 'number', width: 14, align: 'right' },
  { key: 'revenue', label: 'Pendapatan', type: 'currency', width: 20, align: 'right' },
  { key: 'cost', label: 'HPP', type: 'currency', width: 20, align: 'right' },
  { key: 'profit', label: 'Laba', type: 'currency', width: 20, align: 'right' }
]
const totals = ['quantitySold', 'revenue', 'cost', 'profit']
const filename = () => 'penjualan-per-kategori'
const label = 'Penjualan per Kategori'

const getData = async (req) => {
  const { store, startDate, endDate } = req.query
  const userStore = req.cookies?.store || req.user?.store

  const where = store || userStore ? { store: store || userStore } : {}
  if (startDate || endDate) {
    where.report_date = {}
    if (startDate) where.report_date[Op.gte] = new Date(startDate)
    if (endDate) where.report_date[Op.lte] = new Date(endDate)
  }

  const { rows } = await db.category_sales_summary.findAndCountAll({
    where,
    include: [
      {
        model: db.category,
        as: 'categoryData',
        attributes: ['id', 'name']
      },
      { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
    ],
    order: [
      ['revenue', 'DESC'],
      ['report_date', 'DESC']
    ]
  })

  const mapRows = rows.map((r) => ({
    category: r.categoryData?.name || '-',
    quantitySold: Number(r.quantity_sold || 0),
    revenue: Number(r.revenue || 0),
    cost: Number(r.cost || 0),
    profit: Number(r.profit || 0)
  }))

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

module.exports = { getData, defaultColumns, totals, filename, label }
