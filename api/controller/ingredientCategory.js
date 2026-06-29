const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const ExcelJS = require('exceljs')

const ingredientCategoryController = {
  async getAll(req, res) {
    try {
      const { search, status, page = 1, limit = 10 } = req.query

      const where = {}
      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }
      if (status === 'active' || status === 'inactive') {
        where.status = status
      }

      const offset = (page - 1) * limit

      const [categories, total] = await Promise.all([
        db.ingredientCategory.findAll({
          where,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['createdAt', 'DESC']]
        }),
        db.ingredientCategory.count({ where })
      ])

      const totalPages = Math.ceil(total / limit)

      const active = await db.ingredientCategory.count({
        where: { ...where, status: 'active' }
      })
      const draft = await db.ingredientCategory.count({
        where: { ...where, status: 'draft' }
      })
      const inactive = await db.ingredientCategory.count({
        where: { ...where, status: 'inactive' }
      })

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient categories',
        data: categories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        },
        stats: { total, active, draft, inactive }
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params

      const category = await db.ingredientCategory.findByPk(id)

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient category',
        data: category
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
      const { name, status } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const existing = await db.ingredientCategory.findOne({
        where: { name: { [Op.iLike]: name.trim() } }
      })
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Kategori dengan nama tersebut sudah ada'
        })
      }

      const category = await db.ingredientCategory.create({
        name: name.trim(),
        status: ['active', 'inactive', 'draft'].includes(status)
          ? status
          : 'active',
        createdBy
      })

      createAudit(
        req,
        'create',
        'ingredientCategory',
        category.id,
        'Created ingredient category: ' + name
      )

      return res.status(201).json({
        success: true,
        message: 'Success create ingredient category',
        data: category
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
      const { name, status } = req.body
      const modifiedBy = req.user?.id || null

      const category = await db.ingredientCategory.findByPk(id)

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
        const existing = await db.ingredientCategory.findOne({
          where: { name: { [Op.iLike]: name.trim() }, id: { [Op.ne]: id } }
        })
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'Kategori dengan nama tersebut sudah ada'
          })
        }
      }

      await category.update({
        name: name ? name.trim() : category.name,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : category.status,
        modifiedBy
      })

      createAudit(
        req,
        'update',
        'ingredientCategory',
        id,
        'Updated ingredient category: ' + id
      )

      return res.status(200).json({
        success: true,
        message: 'Success update ingredient category',
        data: category
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

      const category = await db.ingredientCategory.findByPk(id)

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      await category.destroy()
      createAudit(
        req,
        'delete',
        'ingredientCategory',
        id,
        'Deleted ingredient category: ' + id
      )

      return res.status(200).json({
        success: true,
        message: 'Success delete ingredient category'
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
      const categories = await db.ingredientCategory.findAll({
        order: [['createdAt', 'DESC']]
      })

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.columns = [
        { header: 'No', key: 'no', width: 8 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Status', key: 'status', width: 15 }
      ]

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      headerRow.eachCell((cell) => {
        cell.protection = { locked: true }
      })

      let rowIndex = 2
      categories.forEach((cat) => {
        const no = rowIndex - 1
        worksheet.getCell(`A${rowIndex}`).value = no
        worksheet.getCell(`A${rowIndex}`).protection = { locked: true }
        worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'center' }

        worksheet.getCell(`B${rowIndex}`).value = cat.name
        worksheet.getCell(`B${rowIndex}`).protection = { locked: false }

        worksheet.getCell(`C${rowIndex}`).value =
          cat.status === 'active'
            ? 'Active'
            : cat.status === 'draft'
              ? 'Draft'
              : 'Non-Active'
        worksheet.getCell(`C${rowIndex}`).protection = { locked: false }
        worksheet.getCell(`C${rowIndex}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Active,Non-Active,Draft"']
        }

        rowIndex++
      })

      const maxRows = Math.max(rowIndex + 50, 100)
      for (let row = rowIndex; row <= maxRows; row++) {
        worksheet.getCell(`A${row}`).value = row - 1
        worksheet.getCell(`A${row}`).protection = { locked: true }
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' }
        ;['B', 'C'].forEach((col) => {
          worksheet.getCell(`${col}${row}`).protection = { locked: false }
        })

        worksheet.getCell(`C${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Active,Non-Active,Draft"']
        }
      }

      worksheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
      })

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=ingredient-category-template.xlsx'
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
      const categories = await db.ingredientCategory.findAll({
        order: [['createdAt', 'DESC']]
      })

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 20 }
      ]

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      categories.forEach((c) => {
        worksheet.addRow({
          id: c.id,
          name: c.name,
          status:
            c.status === 'active'
              ? 'Active'
              : c.status === 'draft'
                ? 'Draft'
                : 'Non-Active',
          createdAt: c.createdAt ? c.createdAt.toISOString() : ''
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=ingredient-categories.xlsx'
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

      const toCreate = []
      const errors = []

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return

        try {
          const values = row.values
          const name = values[2]

          if (!name) return

          const statusRaw = values[3] || 'Active'

          toCreate.push({
            name: name.trim(),
            status: (() => {
              const s = statusRaw.toString().toLowerCase()
              return s === 'draft'
                ? 'draft'
                : s === 'inactive' || s === 'non-active'
                  ? 'inactive'
                  : 'active'
            })(),
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

      const created = await db.ingredientCategory.bulkCreate(toCreate)
      createAudit(
        req,
        'create',
        'ingredientCategory',
        null,
        'Imported ingredient categories: ' + created.length
      )

      return res.status(201).json({
        success: true,
        message: `Successfully imported ${created.length} ingredient categories`,
        data: created
      })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = ingredientCategoryController
