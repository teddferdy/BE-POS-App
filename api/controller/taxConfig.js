const db = require('../../db/models')
const { Op } = require('sequelize')
const ExcelJS = require('exceljs')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

const taxConfigController = {
  async getPublic(req, res) {
    try {
      const store = req.query.store
      if (!store) {
        return res.status(400).json({ message: 'store is required' })
      }
      const storeId = Number(store)
      if (isNaN(storeId)) {
        return res.status(400).json({ message: 'Invalid store value' })
      }
      const { status } = req.query
      const where = { store: storeId }
      if (status !== undefined && status !== 'all') {
        where.status = status
      }
      const taxes = await db.taxConfig.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })
      return res.status(200).json({
        success: true,
        message: 'Success get tax configs',
        data: taxes
      })
    } catch (error) {
      console.error('getPublic error:', error)
      return res.status(500).json({ message: 'Internal server error' })
    }
  },

  async getAll(req, res) {
    try {
      const store =
        req.storeId || req.query.store || req.cookies.store || req.user?.store
      const { page = 1, limit = 10, search, status } = req.query

      // Auto-seed default PPh 2026 data if table is empty
      const totalAll = await db.taxConfig.count()
      if (totalAll === 0) {
        await seedDefaultTaxes()
      }

      const where = {}
      if (store) {
        where[Op.or] = [{ store }, { store: null }]
      }
      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }
      if (status !== undefined && status !== 'all') {
        where.status = status
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [taxes, total] = await Promise.all([
        db.taxConfig.findAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset
        }),
        db.taxConfig.count({ where })
      ])
      await enrichAuditFields(db, taxes)

      const [active, draft, inactive] = await Promise.all([
        db.taxConfig.count({ where: { status: 'active' } }),
        db.taxConfig.count({ where: { status: 'draft' } }),
        db.taxConfig.count({ where: { status: 'inactive' } })
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get tax configs',
        data: taxes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        stats: { total: active + draft + inactive, active, draft, inactive }
      })
    } catch (error) {
      console.error('getAll error:', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const id = String(req.params.id || '').trim()
      const store =
        req.storeId || req.query.store || req.cookies.store || req.user?.store

      const tax = await db.taxConfig.findOne({
        where: {
          id,
          ...(store ? { [Op.or]: [{ store }, { store: null }] } : {})
        }
      })

      if (!tax) {
        return res.status(404).json({
          success: false,
          message: 'Tax config not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get tax config',
        data: tax
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const store =
        req.storeId || req.body.store || req.cookies.store || req.user?.store
      const { name, rate, type, description, status } = req.body
      const createdBy = req.user?.id || null

      if (!name || rate === undefined || rate === null) {
        return res.status(400).json({
          success: false,
          message: 'Name and rate are required'
        })
      }

      const tax = await db.taxConfig.create({
        store,
        name,
        rate: parseInt(rate),
        type: type || 'ppn',
        description,
        status: status || 'active',
        createdBy
      })
      createAudit(
        req,
        'create',
        'tax_config',
        tax.id,
        'Created tax_config: ' + (tax.name || tax.id)
      )

      return res.status(201).json({
        success: true,
        message: 'Success create tax config',
        data: tax
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const store =
        req.storeId || req.body.store || req.cookies.store || req.user?.store
      const { name, rate, type, description, status } = req.body
      const modifiedBy = req.user?.id || null

      const tax = await db.taxConfig.findOne({
        where: { id }
      })

      if (!tax) {
        return res.status(404).json({
          success: false,
          message: 'Tax config not found'
        })
      }

      await tax.update({
        store: store !== undefined ? store || null : tax.store,
        name: name || tax.name,
        rate: rate !== undefined ? parseInt(rate) : tax.rate,
        type: type || tax.type,
        description: description !== undefined ? description : tax.description,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : tax.status,
        modifiedBy
      })
      createAudit(req, 'update', 'tax_config', id, 'Updated tax_config: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success update tax config',
        data: tax
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store || req.user?.store

      const tax = await db.taxConfig.findOne({
        where: {
          id,
          ...(store ? { [Op.or]: [{ store }, { store: null }] } : {})
        }
      })

      if (!tax) {
        return res.status(404).json({
          success: false,
          message: 'Tax config not found'
        })
      }

      await tax.destroy()
      createAudit(req, 'delete', 'tax_config', id, 'Deleted tax_config: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success delete tax config'
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async downloadTemplate(req, res) {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Tax Config Template')

      const headers = ['Name', 'Type', 'Rate', 'Description', 'Status']
      worksheet.addRow(headers)

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      worksheet.columns = [
        { width: 25 },
        { width: 15 },
        { width: 10 },
        { width: 30 },
        { width: 12 }
      ]

      for (let row = 2; row <= 12; row++) {
        worksheet.getCell(`B${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"PPN,PPh,Non-Pajak"']
        }
        worksheet.getCell(`E${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Active,Inactive,Draft"']
        }
      }

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=tax-config-template.xlsx'
      )

      return res.status(200).send(buffer)
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async downloadData(req, res) {
    try {
      const store =
        req.storeId || req.query.store || req.cookies.store || req.user?.store
      const where = {}
      if (store) where.store = store

      const taxes = await db.taxConfig.findAll({
        where,
        order: [['createdAt', 'ASC']]
      })

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Tax Configs')

      worksheet.addRow([
        'ID',
        'Name',
        'Type',
        'Rate',
        'Description',
        'Status',
        'Created At'
      ])
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      taxes.forEach((t) =>
        worksheet.addRow([
          t.id,
          t.name,
          t.type === 'ppn'
            ? 'PPN'
            : t.type === 'service_charge'
              ? 'Non-Pajak'
              : t.type === 'other'
                ? 'PPh'
                : t.type,
          t.rate,
          t.description,
          t.status === 'active' ? 'Active' : 'Inactive',
          t.createdAt ? t.createdAt.toISOString() : ''
        ])
      )

      worksheet.columns = [
        { width: 10 },
        { width: 25 },
        { width: 15 },
        { width: 10 },
        { width: 30 },
        { width: 10 },
        { width: 20 }
      ]

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=tax-configs.xlsx'
      )

      return res.status(200).send(buffer)
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async importData(req, res) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: 'No file uploaded' })
      }

      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(req.file.buffer)
      const worksheet = workbook.getWorksheet(1)

      const taxesToCreate = []
      const errors = []

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return

        try {
          const [, name, type, rate, description, status] = row.values

          if (!name || rate === undefined || rate === null) {
            errors.push(`Row ${rowNumber}: Name and rate are required`)
            return
          }

          const typeValue = String(type || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
          const mappedType =
            typeValue === 'ppn'
              ? 'ppn'
              : typeValue === 'pph'
                ? 'other'
                : typeValue === 'non-pajak'
                  ? 'service_charge'
                  : typeValue === 'service_charge'
                    ? 'service_charge'
                    : 'ppn'

          const statusValue = status
            ? String(status).toLowerCase() === 'draft'
              ? 'draft'
              : String(status).toLowerCase() === 'active'
                ? 'active'
                : 'inactive'
            : 'active'

          taxesToCreate.push({
            store: req.storeId || req.cookies.store || req.user?.store,
            name: name.trim(),
            rate: parseInt(rate),
            type: mappedType,
            description: description?.trim() || null,
            status: statusValue,
            createdBy: req.user?.id || null
          })
        } catch (error) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      })

      if (errors.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: 'Validation errors', errors })
      }

      const created = []
      const skipped = []
      for (const item of taxesToCreate) {
        const existing = await db.taxConfig.findOne({
          where: { name: item.name }
        })
        if (existing) {
          skipped.push(item.name)
          continue
        }
        const tax = await db.taxConfig.create(item)
        created.push(tax)
      }

      createAudit(
        req,
        'create',
        'tax_config',
        null,
        `Imported ${created.length} tax configs, skipped ${skipped.length}`
      )

      return res.status(201).json({
        success: true,
        message: `Successfully imported ${created.length} from ${taxesToCreate.length} tax configs`,
        data: {
          total: taxesToCreate.length,
          created: created.length,
          skipped: skipped.length,
          skippedNames: skipped.length > 0 ? skipped : undefined
        }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async seed(req, res) {
    try {
      const totalAll = await db.taxConfig.count()
      if (totalAll > 0) {
        return res.status(200).json({
          success: true,
          message: `Tax configs already exist (${totalAll} records). No seeding needed.`,
          count: totalAll
        })
      }

      await seedDefaultTaxes()

      const count = await db.taxConfig.count()
      return res.status(201).json({
        success: true,
        message: `Successfully seeded ${count} default PPh 2026 tax configs`,
        count
      })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

async function seedDefaultTaxes() {
  const defaults = [
    {
      name: 'PPN 11%',
      rate: 11,
      type: 'ppn',
      description: 'Pajak Pertambahan Nilai standar barang/jasa',
      status: 'active'
    },
    {
      name: 'PPh 23 2%',
      rate: 2,
      type: 'other',
      description: 'Pajak Penghasilan Pasal 23 atas jasa',
      status: 'active'
    },
    {
      name: 'Non-Pajak',
      rate: 0,
      type: 'service_charge',
      description: 'Transaksi tidak dikenakan pajak',
      status: 'active'
    }
  ]
  await db.taxConfig.bulkCreate(defaults, { individualHooks: false })
}

module.exports = taxConfigController
