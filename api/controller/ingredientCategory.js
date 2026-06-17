const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const ExcelJS = require('exceljs')

const ingredientCategoryController = {
  async getAll(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { search, status } = req.query

      const where = store ? { store } : {}
      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }
      if (status === 'active' || status === 'inactive') {
        where.status = status
      }

      const categories = await db.ingredientCategory.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient categories',
        data: categories
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
      const store = req.cookies.store || req.user?.store

      const category = await db.ingredientCategory.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

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
      const store = req.body.store ? parseInt(req.body.store, 10) : (req.cookies.store || req.user?.store || null)
      const { name, status } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const existing = await db.ingredientCategory.findOne({
        where: { name, store }
      })
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Kategori sudah terdaftar'
        })
      }

      const category = await db.ingredientCategory.create({
        store,
        name,
        status: status === true || status === 'active' ? 'active' : status === false || status === 'inactive' ? 'inactive' : 'active',
        createdBy
      })

      createAudit(req, 'create', 'ingredientCategory', category.id, 'Created ingredient category: ' + name)

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
      const store = req.body.store ? parseInt(req.body.store, 10) : (req.cookies.store || req.user?.store || null)
      const { name, status } = req.body
      const modifiedBy = req.user?.id || null

      const category = await db.ingredientCategory.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      if (name && name !== category.name) {
        const existing = await db.ingredientCategory.findOne({
          where: { name, store, id: { [Op.ne]: id } }
        })
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Kategori sudah terdaftar'
          })
        }
      }

      await category.update({
        name: name || category.name,
        status: status !== undefined
          ? status === true
            ? 'active'
            : status === false
              ? 'inactive'
              : status
          : category.status,
        store: store || category.store,
        modifiedBy
      })

      createAudit(req, 'update', 'ingredientCategory', id, 'Updated ingredient category: ' + id)

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
      const store = req.cookies.store || req.user?.store

      const category = await db.ingredientCategory.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      await category.destroy()
      createAudit(req, 'delete', 'ingredientCategory', id, 'Deleted ingredient category: ' + id)

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
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.addRow(['Name', 'Status'])

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      worksheet.columns = [
        { width: 30 },
        { width: 15 }
      ]

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
      const store = req.query.store || req.cookies.store || req.user?.store
      const where = {}
      if (store) where.store = store

      const categories = await db.ingredientCategory.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.addRow([
        'ID',
        'Name',
        'Status',
        'Created At'
      ])
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      categories.forEach((c) =>
        worksheet.addRow([
          c.id,
          c.name,
          c.status === 'active' ? 'Active' : 'Inactive',
          c.createdAt ? c.createdAt.toISOString() : ''
        ])
      )

      worksheet.columns = [
        { width: 10 },
        { width: 30 },
        { width: 15 },
        { width: 20 }
      ]

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
      const store = req.cookies.store || req.user?.store

      const toCreate = []
      const errors = []

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return

        try {
          const [name, status] = row.values

          if (!name) {
            errors.push(`Row ${rowNumber}: Name is required`)
            return
          }

          toCreate.push({
            store,
            name: name.trim(),
            status: (status || 'active').toString().toLowerCase() === 'inactive' ? 'inactive' : 'active',
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
