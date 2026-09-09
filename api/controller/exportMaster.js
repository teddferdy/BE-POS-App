const { Op } = require('sequelize')
const db = require('../../db/models')
const ExcelJS = require('exceljs')

const EXCLUDED_ATTRS = new Set(['createdAt', 'updatedAt', 'deletedAt'])

const JUNCTION_TABLE_MODELS = {
  category: { table: 'category_store', fk: 'category' },
  product: { table: 'product_store', fk: 'product' }
}

const ALLOWED_TABLES = new Set(['product_store', 'category_store'])

let _ps2 = null
let _cs2 = null
const hasTable = async (t) => {
  if (!ALLOWED_TABLES.has(t)) return false
  if (t === 'product_store') {
    if (_ps2 !== null) return _ps2
  } else if (t === 'category_store') {
    if (_cs2 !== null) return _cs2
  }
  try {
    if (t === 'product_store') {
      await db.sequelize.query('SELECT 1 FROM product_store LIMIT 1')
      _ps2 = true
    } else if (t === 'category_store') {
      await db.sequelize.query('SELECT 1 FROM category_store LIMIT 1')
      _cs2 = true
    }
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
      // CRIT-4: tenant comes EXCLUSIVELY from req.storeId (authorization
      // context, set by validateStoreAccess from the trusted JWT) — never from
      // query/body/cookie.
      const effectiveStore =
        req.storeId !== undefined && req.storeId !== null
          ? parseInt(req.storeId, 10)
          : null

      // Tenant (non-super_admin) accounts must always have a store.
      if (req.user?.roleType !== 'super_admin' && effectiveStore === null) {
        return res.status(403).json({
          success: false,
          message: 'Akun Anda belum ditetapkan ke toko'
        })
      }

      const entities = [
        { model: 'category', sheetName: 'Kategori' },
        { model: 'supplier', sheetName: 'Supplier' },
        { model: 'department', sheetName: 'Departemen' },
        { model: 'position', sheetName: 'Posisi' },
        { model: 'taxConfig', sheetName: 'Konfigurasi Pajak' },
        { model: 'type_payment', sheetName: 'Metode Pembayaran' },
        { model: 'ingredientCategory', sheetName: 'Kategori Bahan Baku' },
        { model: 'ingredient', sheetName: 'Bahan Baku' },
        { model: 'discount', sheetName: 'Diskon' },
        { model: 'currency', sheetName: 'Mata Uang' },
        { model: 'location', sheetName: 'Toko' },
        { model: 'product', sheetName: 'Produk' }
      ]

      const workbook = new ExcelJS.Workbook()

      for (const entity of entities) {
        const Model = db[entity.model]
        if (!Model) continue

        const isScoped = effectiveStore !== null
        const junction = JUNCTION_TABLE_MODELS[entity.model]
        const hasStoreColumn = Object.prototype.hasOwnProperty.call(
          Model.rawAttributes || {},
          'store'
        )

        const where = {}

        if (isScoped && junction && (await hasTable(junction.table))) {
          // Tenant-scoped export: filter through the store junction table.
          const rows = await db.sequelize.query(
            `SELECT "${junction.fk}" AS id FROM "${junction.table}" WHERE store = :store AND "deletedAt" IS NULL`,
            {
              replacements: { store: effectiveStore },
              type: db.sequelize.QueryTypes.SELECT
            }
          )
          const ids = rows.map((r) => r.id)
          where.id = { [Op.in]: ids.length ? ids : [-1] }
        } else if (isScoped && hasStoreColumn) {
          // Tenant-scoped export: filter by the entity's own store column.
          where.store = effectiveStore
        } else if (isScoped) {
          // No store linkage (e.g. department, ingredientCategory): global
          // reference data is NOT included in tenant-scoped exports. It is
          // only exported by a global (super_admin, store=null) export.
          continue
        }
        // Global export (effectiveStore === null): no tenant scoping at all.

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
