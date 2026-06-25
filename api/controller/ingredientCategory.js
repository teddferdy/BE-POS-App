const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const ExcelJS = require('exceljs')
const Location = db.location

const parseStoreField = (val) => {
  if (!val || val === '') return null
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? (parsed.length > 0 ? parsed : null) : [parseInt(val, 10)]
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
        status: ['active', 'inactive', 'draft'].includes(status) ? status : 'active',
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
      const store = req.body.store !== undefined
        ? parseStoreField(req.body.store)
        : undefined
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
        ...(store !== undefined ? { store } : {}),
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
      const categories = await db.ingredientCategory.findAll({
        order: [['createdAt', 'DESC']]
      })

      const Location = db.location
      const stores = await Location.findAll({
        where: { status: 'active' },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']]
      })
      const storeNames = stores.map((s) => s.name)
      const storeDropdown = ['All Stores', ...storeNames].join(',')

      const storeNameById = {}
      stores.forEach((s) => { storeNameById[s.id] = s.name })

      const formatStores = (storeVal) => {
        if (!storeVal || !Array.isArray(storeVal) || storeVal.length === 0) return 'All Stores'
        return storeVal.map((id) => storeNameById[id] || `Store #${id}`).join(', ')
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.columns = [
        { header: 'No', key: 'no', width: 8 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Store', key: 'store', width: 20 }
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
          cat.status === 'active' ? 'Active' : cat.status === 'draft' ? 'Draft' : 'Non-Active'
        worksheet.getCell(`C${rowIndex}`).protection = { locked: false }
        worksheet.getCell(`C${rowIndex}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Active,Non-Active,Draft"']
        }

        worksheet.getCell(`D${rowIndex}`).value = formatStores(cat.store)
        worksheet.getCell(`D${rowIndex}`).protection = { locked: false }
        worksheet.getCell(`D${rowIndex}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${storeDropdown}"`]
        }

        rowIndex++
      })

      const maxRows = Math.max(rowIndex + 50, 100)
      for (let row = rowIndex; row <= maxRows; row++) {
        worksheet.getCell(`A${row}`).value = row - 1
        worksheet.getCell(`A${row}`).protection = { locked: true }
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' }
        ;['B', 'C', 'D'].forEach((col) => {
          worksheet.getCell(`${col}${row}`).protection = { locked: false }
        })

        worksheet.getCell(`C${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Active,Non-Active,Draft"']
        }

        worksheet.getCell(`D${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${storeDropdown}"`]
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

      const Location = db.location
      const allStoreIds = [...new Set(categories.flatMap((c) => (Array.isArray(c.store) ? c.store : [])))]
      const locationMap = {}
      if (allStoreIds.length > 0) {
        const locations = await Location.findAll({
          where: { id: allStoreIds },
          attributes: ['id', 'name']
        })
        locations.forEach((l) => { locationMap[l.id] = l.name })
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Kategori Bahan Baku')

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Store', key: 'store', width: 20 },
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
        const storeVal = Array.isArray(c.store) && c.store.length > 0
          ? c.store.map((id) => locationMap[id] || `Store #${id}`).join(', ')
          : 'All Stores'
        worksheet.addRow({
          id: c.id,
          name: c.name,
          status: c.status === 'active' ? 'Active' : c.status === 'draft' ? 'Draft' : 'Non-Active',
          store: storeVal,
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
      const store = req.cookies.store || req.user?.store
      const storeId = store ? [parseInt(store, 10)] : null

      const Location = db.location
      const allLocations = await Location.findAll({
        where: { status: 'active' },
        attributes: ['id', 'name']
      })
      const locationByName = {}
      allLocations.forEach((l) => { locationByName[l.name.toLowerCase().trim()] = l.id })

      const toCreate = []
      const errors = []

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return

        try {
          const values = row.values
          const name = values[2]

          if (!name) return

          const statusRaw = values[3] || 'Active'
          const storeRaw = values[4] ? values[4].toString().trim() : ''

          let storeIds = storeId
          if (storeRaw && storeRaw.toLowerCase() !== 'all stores') {
            const names = storeRaw.split(',').map((s) => s.trim().toLowerCase())
            const ids = names
              .map((n) => locationByName[n])
              .filter((id) => id != null)
            if (ids.length > 0) storeIds = ids
          } else if (storeRaw.toLowerCase() === 'all stores') {
            storeIds = null
          }

          toCreate.push({
            store: storeIds,
            name: name.trim(),
            status: (() => {
              const s = statusRaw.toString().toLowerCase()
              return s === 'draft' ? 'draft' : s === 'inactive' || s === 'non-active' ? 'inactive' : 'active'
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
