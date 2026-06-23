const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const ExcelJS = require('exceljs')
const Location = db.location

const parseStoreField = (val) => {
  if (!val || val === '') return null
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : [parseInt(val, 10)]
  } catch {
    return [parseInt(val, 10)]
  }
}

const resolveStoreNames = async (storeIds) => {
  if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) return []
  const locations = await Location.findAll({
    where: { id: storeIds },
    attributes: ['id', 'name']
  })
  return locations.map((l) => ({ id: l.id, name: l.name }))
}

const ingredientCategoryController = {
  async getAll(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { search, status } = req.query
      const storeId = store ? parseInt(store, 10) : null

      const where = {}
      if (storeId) {
        where[Op.or] = [
          { store: null },
          { store: { [Op.contains]: [storeId] } }
        ]
      }
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

      const allStoreIds = [
        ...new Set(categories.flatMap((c) => (Array.isArray(c.store) ? c.store : [])))
      ]
      const locationMap = {}
      if (allStoreIds.length > 0) {
        const locations = await Location.findAll({
          where: { id: allStoreIds },
          attributes: ['id', 'name']
        })
        locations.forEach((l) => {
          locationMap[l.id] = l.name
        })
      }

      const data = categories.map((c) => ({
        ...c.toJSON(),
        store: Array.isArray(c.store) ? c.store.map((id) => ({ id, name: locationMap[id] || null })) : c.store
      }))

      const total = categories.length
      const active = categories.filter((c) => c.status === 'active').length
      const draft = categories.filter((c) => c.status === 'draft').length
      const inactive = categories.filter((c) => c.status === 'inactive').length

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient categories',
        data,
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
      const store = req.cookies.store || req.user?.store
      const storeId = store ? parseInt(store, 10) : null

      const where = { id }
      if (storeId) {
        where[Op.or] = [
          { store: null },
          { store: { [Op.contains]: [storeId] } }
        ]
      }

      const category = await db.ingredientCategory.findOne({ where })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      const resolved = category.toJSON()
      if (Array.isArray(resolved.store)) {
        resolved.store = await resolveStoreNames(resolved.store)
      }

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient category',
        data: resolved
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
      const store = parseStoreField(req.body.store) ||
        (req.cookies.store
          ? [parseInt(req.cookies.store, 10)]
          : req.user?.store
            ? [parseInt(req.user.store, 10)]
            : null)
      const { name, status } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const category = await db.ingredientCategory.create({
        store,
        name,
        status:
          status === true || status === 'active'
            ? 'active'
            : status === false || status === 'inactive'
              ? 'inactive'
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
      const store = parseStoreField(req.body.store) ||
        (req.cookies.store
          ? [parseInt(req.cookies.store, 10)]
          : req.user?.store
            ? [parseInt(req.user.store, 10)]
            : null)
      const { name, status } = req.body
      const modifiedBy = req.user?.id || null

      const category = await db.ingredientCategory.findByPk(id)

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      await category.update({
        name: name || category.name,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : category.status,
        store: store || category.store,
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
      const store = req.cookies.store || req.user?.store
      const storeId = store ? parseInt(store, 10) : null

      const where = { id }
      if (storeId) {
        where[Op.or] = [
          { store: null },
          { store: { [Op.contains]: [storeId] } }
        ]
      }

      const category = await db.ingredientCategory.findOne({ where })

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
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.addRow(['Name', 'Status'])

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      worksheet.columns = [{ width: 30 }, { width: 15 }]

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
      const storeId = store ? parseInt(store, 10) : null
      const where = {}
      if (storeId) {
        where[Op.or] = [
          { store: null },
          { store: { [Op.contains]: [storeId] } }
        ]
      }

      const categories = await db.ingredientCategory.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.addRow(['ID', 'Name', 'Status', 'Created At'])
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
      const storeId = store ? [parseInt(store, 10)] : null

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
            store: storeId,
            name: name.trim(),
            status: (() => {
              const s = (status || 'active').toString().toLowerCase()
              return s === 'draft' ? 'draft' : s === 'inactive' ? 'inactive' : 'active'
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
