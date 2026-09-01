'use strict'
const db = require('../../db/models')

const reportDefs = {
  daily: require('../service/reportDefs/daily'),
  sales: require('../service/reportDefs/sales'),
  cashFlow: require('../service/reportDefs/cashFlow'),
  profitPerProduct: require('../service/reportDefs/profitPerProduct'),
  bestSeller: require('../service/reportDefs/bestSeller'),
  productSales: require('../service/reportDefs/productSales'),
  categorySales: require('../service/reportDefs/categorySales'),
  kasirPerformance: require('../service/reportDefs/kasirPerformance')
}

const DEFAULT_CONFIG = {
  selectedColumns: null, // null = use def.defaultColumns
  accentColor: '#0f172a',
  branding: { showLogo: true, showAddress: true, showPhone: true }
}

const listConfigs = async (req, res) => {
  try {
    const rows = await db.reportConfig.findAll()
    return res.json({ success: true, data: rows.map((r) => ({ key: r.key, config: r.config })) })
  } catch (err) {
    console.error('reportConfig list error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

const getConfig = async (req, res) => {
  try {
    const { key } = req.params
    const row = await db.reportConfig.findOne({ where: { key } })
    return res.json({ success: true, data: { key, config: row ? row.config : null } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const upsertConfig = async (req, res) => {
  try {
    const { key } = req.params
    if (!reportDefs[key]) return res.status(404).json({ success: false, message: 'Report tidak ditemukan' })
    const { config } = req.body || {}
    if (!config) return res.status(400).json({ success: false, message: 'config wajib diisi' })
    const merged = { ...DEFAULT_CONFIG, ...config }
    const [row, created] = await db.reportConfig.findOrCreate({
      where: { key },
      defaults: { key, config: merged }
    })
    if (!created) { row.config = merged; await row.save() }
    return res.json({ success: true, data: { key, config: merged } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const getMeta = async (req, res) => {
  try {
    const data = Object.entries(reportDefs).map(([key, def]) => ({
      key,
      label: def.label,
      columns: def.defaultColumns
    }))
    return res.json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { listConfigs, getConfig, upsertConfig, getMeta, DEFAULT_CONFIG }