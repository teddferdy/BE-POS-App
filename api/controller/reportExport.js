'use strict'
const db = require('../../db/models')
const reportDefs = require('../service/reportDefs')
const { exportReport } = require('../service/reportExporter')

const VALID_FORMATS = ['excel', 'pdf', 'csv']

const loadBrand = async () => {
  const loc = await db.location.findOne({ where: { mainBranch: true }, order: [['id', 'ASC']] })
  if (loc) {
    return {
      name: loc.name, address: loc.address, city: loc.city,
      province: loc.province, postalCode: loc.postalCode,
      phoneNumber: loc.phoneNumber, email: loc.email, logo: loc.image || null
    }
  }
  return null
}

const buildSpecFromDef = (def, data, config, brand) => {
  const columns = (config?.selectedColumns || def.defaultColumns.map((c) => c.key))
    .map((key) => def.defaultColumns.find((c) => c.key === key))
    .filter(Boolean)
  const cfg = config || {}
  return {
    title: data.title || def.label,
    subtitle: data.subtitle || '',
    brand,
    columns,
    rows: data.rows || [],
    totals: def.totals,
    accentColor: cfg.accentColor || '#0f172a',
    archetype: def.archetype || 'summary',
    layout: def.layout || null,
    branding: cfg.branding || { showLogo: true, showAddress: true, showPhone: true }
  }
}

const exportOne = async (req, res) => {
  try {
    const { key } = req.params
    const format = req.query.format
    const def = reportDefs[key]
    if (!def) return res.status(404).json({ success: false, message: 'Report tidak ditemukan' })
    if (!VALID_FORMATS.includes(format)) return res.status(400).json({ success: false, message: 'Format tidak didukung' })

    const data = await def.getData(req)
    const configRow = await db.reportConfig.findOne({ where: { key } })
    const config = configRow?.config || null
    const brand = await loadBrand()
    const spec = buildSpecFromDef(def, data, config, brand)

    await exportReport({ format, spec, filename: def.filename(req), res })
  } catch (err) {
    console.error('Export error:', err)
    if (!res.headersSent) return res.status(500).json({ success: false, message: err.message })
    res.end()
  }
}

module.exports = { exportOne, buildSpecFromDef, loadBrand }
