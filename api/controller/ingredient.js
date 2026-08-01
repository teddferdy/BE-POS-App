const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')
const excelJS = require('exceljs')

const ingredientController = {
  async getAll(req, res) {
    try {
      const storeParam = req.query.store
      const store = storeParam && !isNaN(Number(storeParam))
        ? storeParam
        : req.user?.roleType !== 'super_admin'
          ? req.user?.store
          : undefined
      const {
        search,
        status,
        lowStock,
        supplier,
        page = 1,
        limit = 10
      } = req.query
      const offset = (parseInt(page) - 1) * parseInt(limit)

      const where = {}
      const andConditions = []
      if (store) {
        where[Op.or] = [{ store }, { store: null }]
      }
      if (search) {
        andConditions.push({ name: { [Op.iLike]: `%${search}%` } })
      }
      if (status !== undefined && status !== 'all') {
        andConditions.push({
          status
        })
      }
      if (supplier) {
        andConditions.push({ supplier: Number(supplier) })
      }
      if (andConditions.length > 0) {
        where[Op.and] = andConditions
      }

      let { count, rows: ingredients } = await db.ingredient.findAndCountAll({
        where,
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name']
          },
          {
            model: db.ingredientCategory,
            as: 'categoryData',
            attributes: ['id', 'name']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name']
          }
        ],
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']]
      })

      await enrichAuditFields(db, ingredients)

      if (lowStock === 'true') {
        ingredients = ingredients.filter((ing) => ing.stock <= ing.minStock)
        count = ingredients.length
      }

      const storeFilter = store ? { [Op.or]: [{ store }, { store: null }] } : {}
      const [active, draft, inactive] = await Promise.all([
        db.ingredient.count({ where: { ...storeFilter, status: 'active' } }),
        db.ingredient.count({ where: { ...storeFilter, status: 'draft' } }),
        db.ingredient.count({ where: { ...storeFilter, status: 'inactive' } })
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get ingredients',
        totalItems: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        data: ingredients,
        stats: { total: active + draft + inactive, active, draft, inactive },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store || req.user?.store

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) },
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name', 'phone']
          },
          {
            model: db.ingredientCategory,
            as: 'categoryData',
            attributes: ['id', 'name']
          }
        ]
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient',
        data: ingredient
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const store = req.storeId || req.body.store || req.cookies.store || req.user?.store
      const {
        name,
        category,
        supplier,
        stock = 0,
        minStock = 0,
        unit,
        costPrice,
        status,
        baseUnit,
        conversionFactor
      } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const ingredient = await db.ingredient.create({
        store,
        name,
        category,
        supplier,
        stock,
        minStock,
        unit: unit || 'pcs',
        baseUnit: baseUnit || unit || 'pcs',
        conversionFactor:
          conversionFactor != null ? parseFloat(conversionFactor) : 1,
        costPrice: costPrice || 0,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : 'active',
        createdBy
      })
      createAudit(
        req,
        'create',
        'ingredient',
        ingredient.id,
        'Created ingredient: ' + (ingredient.name || ingredient.id)
      )

      return res.status(201).json({
        success: true,
        message: 'Success create ingredient',
        data: ingredient
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store || req.user?.store
      const {
        name,
        category,
        supplier,
        stock,
        minStock,
        unit,
        costPrice,
        status,
        baseUnit,
        conversionFactor
      } = req.body
      const modifiedBy = req.user?.id || null

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      const oldStock = ingredient.stock

      await ingredient.update({
        name: name || ingredient.name,
        category: category !== undefined ? category : ingredient.category,
        supplier: supplier !== undefined ? supplier : ingredient.supplier,
        stock: stock !== undefined ? stock : ingredient.stock,
        minStock: minStock !== undefined ? minStock : ingredient.minStock,
        unit: unit || ingredient.unit,
        baseUnit: baseUnit !== undefined ? baseUnit : ingredient.baseUnit,
        conversionFactor:
          conversionFactor != null
            ? parseFloat(conversionFactor)
            : ingredient.conversionFactor,
        store: store !== undefined ? store : ingredient.store,
        costPrice: costPrice !== undefined ? costPrice : ingredient.costPrice,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : ingredient.status,
        modifiedBy
      })
      createAudit(req, 'update', 'ingredient', id, 'Updated ingredient: ' + id)

      if (stock !== undefined && stock !== oldStock) {
        const quantityBefore = oldStock
        const quantityChange = stock - oldStock

        await db.stock_history.create({
          store,
          ingredientName: ingredient.name,
          referenceType: 'adjustment',
          referenceId: id,
          quantityBefore,
          quantityChange,
          quantityAfter: stock,
          unit: ingredient.unit,
          createdBy: req.user?.id
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success update ingredient',
        data: ingredient
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async adjustStock(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store || req.user?.store
      const { quantity, type, notes } = req.body

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      const quantityBefore = ingredient.stock
      let quantityChange = quantity

      if (type === 'add') {
        quantityChange = quantity
      } else if (type === 'subtract') {
        quantityChange = -quantity
        if (ingredient.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock'
          })
        }
      } else if (type === 'set') {
        quantityChange = quantity - ingredient.stock
      }

      const quantityAfter = quantityBefore + quantityChange

      await db.stock_history.create({
        store,
        ingredientName: ingredient.name,
        referenceType: 'adjustment',
        referenceId: id,
        quantityBefore,
        quantityChange,
        quantityAfter,
        unit: ingredient.unit,
        notes,
        createdBy: req.user?.id
      })

      await ingredient.update({ stock: quantityAfter })

      return res.status(200).json({
        success: true,
        message: 'Success adjust stock',
        data: {
          ingredient,
          quantityBefore,
          quantityChange,
          quantityAfter
        }
      })
    } catch (error) {
      console.log(error)
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

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      await ingredient.destroy()
      createAudit(req, 'delete', 'ingredient', id, 'Deleted ingredient: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success delete ingredient'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async downloadTemplate(req, res) {
    try {
      const store = req.storeId || req.cookies.store || req.user?.store
      const categories = await db.ingredientCategory.findAll({
        where: store ? { store } : {},
        attributes: ['name'],
        order: [['createdAt', 'ASC']]
      })
      const suppliers = await db.supplier.findAll({
        where: store ? { store } : {},
        attributes: ['name'],
        order: [['createdAt', 'ASC']]
      })
      const catList = categories.map((c) => c.name).join(',')
      const suppList = suppliers.map((s) => s.name).join(',')

      const workbook = new excelJS.Workbook()

      // --- Sheet 1: Template ---
      const ws = workbook.addWorksheet('Template')
      ws.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Nama Bahan Baku', key: 'name', width: 28 },
        { header: 'Kategori', key: 'category', width: 22 },
        { header: 'Supplier', key: 'supplier', width: 22 },
        { header: 'Unit Pembelian', key: 'unit', width: 18 },
        { header: 'Base Unit', key: 'baseUnit', width: 16 },
        { header: 'Faktor Konversi', key: 'conversionFactor', width: 16 },
        { header: 'Stok Awal', key: 'stock', width: 12 },
        { header: 'Minimal Stok', key: 'minStock', width: 14 },
        { header: 'Harga Beli (Rp)', key: 'costPrice', width: 16 },
        { header: 'Status', key: 'status', width: 14 }
      ]

      const headerRow = ws.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.protection = { locked: true }
      })

      for (let r = 2; r <= 200; r++) {
        ws.getCell(`C${r}`).dataValidation = {
          type: 'list',
          formulae: [catList ? `"${catList}"` : '""'],
          showErrorMessage: true,
          errorTitle: 'Kategori tidak valid',
          error: 'Pilih kategori yang tersedia'
        }
        ws.getCell(`D${r}`).dataValidation = {
          type: 'list',
          formulae: [suppList ? `"${suppList}"` : '""'],
          showErrorMessage: true,
          errorTitle: 'Supplier tidak valid',
          error: 'Pilih supplier yang tersedia'
        }
        ws.getCell(`E${r}`).dataValidation = {
          type: 'list',
          formulae: [
            '"pcs,buah,kg,gram,liter,ml,meter,cm,lusin,pack,box,karton"'
          ],
          showErrorMessage: true,
          errorTitle: 'Unit tidak valid'
        }
        ws.getCell(`F${r}`).dataValidation = {
          type: 'list',
          formulae: ['"pcs,gram,ml,cm,buah,lembar"'],
          showErrorMessage: true,
          errorTitle: 'Base Unit tidak valid'
        }
        ws.getCell(`K${r}`).dataValidation = {
          type: 'list',
          formulae: ['"Active,Inactive,Draft"'],
          showErrorMessage: true,
          errorTitle: 'Status tidak valid',
          error: 'Pilih Active, Inactive, atau Draft'
        }
      }

      // Pre-fill conversion hints
      const hints = [
        { unit: 'kg', base: 'gram', factor: 1000 },
        { unit: 'liter', base: 'ml', factor: 1000 },
        { unit: 'meter', base: 'cm', factor: 100 },
        { unit: 'lusin', base: 'pcs', factor: 12 },
        { unit: 'karton', base: 'pcs', factor: 50 },
        { unit: 'box', base: 'pcs', factor: 10 },
        { unit: 'pack', base: 'pcs', factor: 5 }
      ]
      const sampleRow = 3
      ws.getCell(`A${sampleRow}`).value = 1
      ws.getCell(`B${sampleRow}`).value = 'Contoh: Tepung Terigu'
      ws.getCell(`E${sampleRow}`).value = 'kg'
      ws.getCell(`F${sampleRow}`).value = 'gram'
      ws.getCell(`G${sampleRow}`).value = 1000
      ws.getCell(`H${sampleRow}`).value = 0
      ws.getCell(`I${sampleRow}`).value = 10
      ws.getCell(`J${sampleRow}`).value = 12000
      ws.getCell(`K${sampleRow}`).value = 'Active'

      // Unlock all data cells so users can edit freely
      for (let r = 1; r <= 200; r++) {
        for (let c = 1; c <= 11; c++) {
          ws.getCell(r, c).protection = { locked: false }
        }
      }

      // --- Sheet 2: Rumus Konversi ---
      const rs = workbook.addWorksheet('Rumus Konversi')
      rs.columns = [
        { header: 'Unit Pembelian', key: 'unit', width: 18 },
        { header: 'Base Unit', key: 'base', width: 16 },
        { header: 'Faktor Konversi', key: 'factor', width: 18 },
        { header: 'Rumus', key: 'formula', width: 30 }
      ]
      const rHeader = rs.getRow(1)
      rHeader.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
      rHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      rHeader.alignment = { horizontal: 'center', vertical: 'middle' }

      hints.forEach((h, i) => {
        const row = i + 2
        rs.getCell(`A${row}`).value = h.unit
        rs.getCell(`B${row}`).value = h.base
        rs.getCell(`C${row}`).value = h.factor
        rs.getCell(`D${row}`).value = `1 ${h.unit} = ${h.factor} ${h.base}`
      })

      rs.addRow([])
      rs.addRow(['', '', '', 'Stok dalam sistem tersimpan dalam Base Unit'])
      rs.addRow(['', '', '', 'Contoh: Stok 5 kg tersimpan sebagai 5000 gram'])

      const buffer = await workbook.xlsx.writeBuffer()
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=template-bahan-baku.xlsx'
      )
      return res.send(buffer)
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async downloadData(req, res) {
    try {
      const store = req.storeId || req.cookies.store || req.user?.store
      const ingredients = await db.ingredient.findAll({
        where: store ? { store } : {},
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name']
          },
          {
            model: db.ingredientCategory,
            as: 'categoryData',
            attributes: ['id', 'name']
          }
        ],
        order: [['createdAt', 'ASC']]
      })

      const workbook = new excelJS.Workbook()
      const ws = workbook.addWorksheet('Bahan Baku')
      ws.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Nama Bahan Baku', key: 'name', width: 28 },
        { header: 'Kategori', key: 'category', width: 22 },
        { header: 'Supplier', key: 'supplier', width: 22 },
        { header: 'Unit Pembelian', key: 'unit', width: 18 },
        { header: 'Base Unit', key: 'baseUnit', width: 16 },
        { header: 'Faktor Konversi', key: 'conversionFactor', width: 16 },
        { header: 'Stok', key: 'stock', width: 12 },
        { header: 'Minimal Stok', key: 'minStock', width: 14 },
        { header: 'Harga Beli', key: 'costPrice', width: 16 },
        { header: 'Status', key: 'status', width: 12 }
      ]

      const headerRow = ws.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 28

      ingredients.forEach((ing, i) => {
        ws.addRow({
          no: i + 1,
          name: ing.name,
          category: ing.categoryData?.name || '',
          supplier: ing.supplierData?.name || '',
          unit: ing.unit || 'pcs',
          baseUnit: ing.baseUnit || ing.unit || 'pcs',
          conversionFactor: ing.conversionFactor || 1,
          stock: ing.stock,
          minStock: ing.minStock,
          costPrice: ing.costPrice || 0,
          status: ing.status === 'active' ? 'Active' : 'Inactive'
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=data-bahan-baku.xlsx'
      )
      return res.send(buffer)
    } catch (error) {
      console.log(error)
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
          .json({ success: false, message: 'Tidak ada file yang diupload' })
      }

      const store = req.user?.store
      if (!store) {
        return res
          .status(400)
          .json({ success: false, message: 'Store tidak ditemukan' })
      }

      const workbook = new excelJS.Workbook()
      await workbook.xlsx.load(req.file.buffer)
      const ws = workbook.getWorksheet('Template')
      if (!ws) {
        return res
          .status(400)
          .json({ success: false, message: 'Sheet "Template" tidak ditemukan' })
      }

      // Validate headers
      const expected = [
        'No',
        'Nama Bahan Baku',
        'Kategori',
        'Supplier',
        'Unit Pembelian',
        'Base Unit',
        'Faktor Konversi',
        'Stok Awal',
        'Minimal Stok',
        'Harga Beli (Rp)',
        'Status'
      ]
      const headers = []
      ws.getRow(1).eachCell((cell) => {
        headers.push(cell.value ? String(cell.value).trim() : '')
      })
      const headerValid = expected.every((h, i) => headers[i] === h)
      if (!headerValid) {
        return res.status(400).json({
          success: false,
          message: 'Header file tidak sesuai dengan template'
        })
      }

      // Fetch lookup maps — match store OR global (store IS NULL)
      const allCategories = await db.ingredientCategory.findAll({
        where: store ? { [Op.or]: [{ store }, { store: null }] } : {}
      })
      const categoryMap = {}
      allCategories.forEach((c) => {
        categoryMap[c.name.toLowerCase()] = c.id
      })

      const allSuppliers = await db.supplier.findAll({
        where: store ? { [Op.or]: [{ store }, { store: null }] } : {}
      })
      const supplierMap = {}
      allSuppliers.forEach((s) => {
        supplierMap[s.name.toLowerCase()] = s.id
      })

      // Parse rows
      const ingredients = []
      const errors = []

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return // skip header
        const name = row.getCell(2).value
        if (!name) return
        const ingredientName = String(name).trim()
        if (!ingredientName || ingredientName.startsWith('Contoh:')) return

        const catName = row.getCell(3).value
          ? String(row.getCell(3).value).trim()
          : ''
        const suppName = row.getCell(4).value
          ? String(row.getCell(4).value).trim()
          : ''
        const unit = row.getCell(5).value
          ? String(row.getCell(5).value).trim().toLowerCase()
          : 'pcs'
        const baseUnit = row.getCell(6).value
          ? String(row.getCell(6).value).trim().toLowerCase()
          : unit
        const conversionFactor = parseFloat(row.getCell(7).value) || 1
        const stock = parseInt(row.getCell(8).value) || 0
        const minStock = parseInt(row.getCell(9).value) || 0
        const costPrice =
          parseInt(String(row.getCell(10).value).replace(/[^0-9]/g, '')) || 0
        const statusRaw = row.getCell(11).value
          ? String(row.getCell(11).value).trim().toLowerCase()
          : 'active'
        const status = ['active', 'inactive', 'draft'].includes(statusRaw)
          ? statusRaw
          : 'active'

        // Resolve category
        let categoryId = null
        if (catName) {
          categoryId = categoryMap[catName.toLowerCase()]
          if (!categoryId)
            errors.push(
              `Baris ${rowNumber}: Kategori "${catName}" tidak ditemukan`
            )
        }

        // Resolve supplier
        let supplierId = null
        if (suppName) {
          supplierId = supplierMap[suppName.toLowerCase()]
          if (!supplierId)
            errors.push(
              `Baris ${rowNumber}: Supplier "${suppName}" tidak ditemukan`
            )
        }

        ingredients.push({
          store,
          name: ingredientName,
          category: categoryId,
          supplier: supplierId,
          unit,
          baseUnit,
          conversionFactor,
          stock,
          minStock,
          costPrice,
          status,
          createdBy: req.user?.id || null
        })
      })

      // Insert with duplicate checking
      let insertedCount = 0
      const duplicateErrors = []
      for (const ing of ingredients) {
        const existing = await db.ingredient.findOne({
          where: { name: ing.name, store: ing.store }
        })
        if (existing) {
          duplicateErrors.push(`"${ing.name}" sudah terdaftar`)
          continue
        }
        await db.ingredient.create(ing)
        insertedCount++
      }

      createAudit(
        req,
        'import',
        'ingredient',
        null,
        `Imported ${insertedCount} ingredients`
      )

      return res.status(201).json({
        success: true,
        message: `Berhasil import ${insertedCount} dari ${ingredients.length} bahan baku`,
        data: {
          total: ingredients.length,
          created: insertedCount,
          skipped: duplicateErrors.length,
          skippedNames: duplicateErrors.length > 0 ? duplicateErrors : undefined
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getProductNames(req, res) {
    try {
      const { category, supplier } = req.query

      if (!supplier) {
        return res.status(400).json({
          success: false,
          message: 'Supplier is required'
        })
      }

      const supplierId = Number(supplier)

      const where = { supplier: supplierId }
      const productAttrs = ['id', 'supplier', 'productId', 'name', 'price', 'unit', 'leadTime', 'leadTimeUnit', 'qualityRating', 'minOrderQty', 'notes', 'lastPrice', 'createdBy', 'modifiedBy', 'createdAt', 'updatedAt']
      let products = await db.supplier_product.findAll({
        where,
        attributes: productAttrs,
        raw: true
      })

      if (category) {
        const usedIngredients = await db.ingredient.findAll({
          where: {
            supplier: supplierId,
            category: Number(category)
          },
          attributes: ['name'],
          raw: true
        })
        const usedNames = usedIngredients.map((i) =>
          i.name.toLowerCase().trim()
        )
        if (usedNames.length > 0) {
          products = products.filter((p) =>
            usedNames.includes(p.name.toLowerCase().trim())
          )
        }
      }

      const seen = new Set()
      products = products.filter((p) => {
        const key = p.name.toLowerCase().trim()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      return res.status(200).json({
        success: true,
        message: 'Success get product names',
        data: products
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = ingredientController
