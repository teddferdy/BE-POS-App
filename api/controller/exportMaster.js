const { Op } = require('sequelize')
const db = require('../../db/models')
const ExcelJS = require('exceljs')

const EXCLUDED_ATTRS = new Set(['createdAt', 'updatedAt', 'deletedAt'])

const JUNCTION_TABLE_MODELS = {
  category: { table: 'category_store', fk: 'category' },
  product: { table: 'product_store', fk: 'product' }
}

let _ps2 = null
let _cs2 = null
const hasTable = async (t) => {
  if (t === 'product_store') {
    if (_ps2 !== null) return _ps2
  } else if (t === 'category_store') {
    if (_cs2 !== null) return _cs2
  }
  try {
    await db.sequelize.query(`SELECT 1 FROM ${t} LIMIT 1`)
    if (t === 'product_store') _ps2 = true
    if (t === 'category_store') _cs2 = true
    return true
  } catch {
    if (t === 'product_store') _ps2 = false
    if (t === 'category_store') _cs2 = false
    return false
  }
}

function getSerializedValue(value) {
  if (value === null || value === undefined) return ''
  if (Buffer.isBuffer(value)) return '[binary data]'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const exportMasterController = {
  async exportAll(req, res) {
    try {
      const { store } = req.query

      const entities = [
        { model: 'category', sheetName: 'Kategori', filterable: true },
        { model: 'supplier', sheetName: 'Supplier', filterable: true },
        { model: 'department', sheetName: 'Departemen', filterable: false },
        { model: 'position', sheetName: 'Posisi', filterable: true },
        {
          model: 'taxConfig',
          sheetName: 'Konfigurasi Pajak',
          filterable: true
        },
        {
          model: 'type_payment',
          sheetName: 'Metode Pembayaran',
          filterable: true
        },
        {
          model: 'ingredientCategory',
          sheetName: 'Kategori Bahan Baku',
          filterable: true
        },
        { model: 'ingredient', sheetName: 'Bahan Baku', filterable: true },
        { model: 'discount', sheetName: 'Diskon', filterable: true },
        { model: 'currency', sheetName: 'Mata Uang', filterable: true },
        { model: 'location', sheetName: 'Toko', filterable: true },
        { model: 'product', sheetName: 'Produk', filterable: false }
      ]

      const workbook = new ExcelJS.Workbook()

      for (const entity of entities) {
        const Model = db[entity.model]
        if (!Model) continue

        const where = {}
        if (store && entity.filterable) {
          const junction = JUNCTION_TABLE_MODELS[entity.model]
          if (junction && (await hasTable(junction.table))) {
            const rows = await db.sequelize.query(
              `SELECT "${junction.fk}" AS id FROM "${junction.table}" WHERE store = ${Number(store)} AND "deletedAt" IS NULL`,
              { type: db.sequelize.QueryTypes.SELECT }
            )
            const ids = rows.map((r) => r.id)
            if (ids.length === 0) {
              where.id = { [Op.in]: [-1] }
            } else {
              where.id = { [Op.in]: ids }
            }
          } else {
            where.store = store
          }
        }

        const records = await Model.findAll({
          where,
          order: [['id', 'ASC']]
        })
        if (!records.length) continue

        const rawAttrs = Model.rawAttributes || {}
        const columns = Object.keys(rawAttrs).filter(
          (key) => !EXCLUDED_ATTRS.has(key)
        )

        const worksheet = workbook.addWorksheet(entity.sheetName)

        worksheet.addRow(columns)

        worksheet.getRow(1).font = { bold: true }
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }
        }

        worksheet.columns = columns.map(() => ({ width: 20 }))

        records.forEach((record) => {
          const row = columns.map((col) =>
            getSerializedValue(record.getDataValue(col))
          )
          worksheet.addRow(row)
        })
      }

      const buffer = await workbook.xlsx.writeBuffer()

      const filename = `backup-master-data-${Date.now()}.xlsx`
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`)

      return res.status(200).send(buffer)
    } catch (error) {
      console.error('Export master data error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = exportMasterController
