const db = require('../../db/models')
const { Op } = require('sequelize')
const Category = db.category
const Product = db.product
const Location = db.location
const excelJS = require('exceljs')
const {
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

let _categoryStoreExists = null
const hasCategoryStoreTable = async () => {
  if (_categoryStoreExists !== null) return _categoryStoreExists
  try {
    await db.sequelize.query('SELECT 1 FROM category_store LIMIT 1')
    _categoryStoreExists = true
  } catch {
    _categoryStoreExists = false
  }
  return _categoryStoreExists
}

const normalizeStores = (stores) => {
  if (!Array.isArray(stores)) return []
  return stores.flatMap((s) => {
    if (s == null) return []
    return typeof s === 'object' ? [s.id] : [s]
  })
}

const parseStoreField = (val) => {
  if (!val || val === '') return []
  if (Array.isArray(val)) return normalizeStores(val)
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? normalizeStores(parsed) : [parseInt(val, 10)]
  } catch {
    return [parseInt(val, 10)]
  }
}

const resolveStoreNames = async (storeIds) => {
  if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) return []
  const ids = normalizeStores(storeIds)
  const locations = await Location.findAll({
    where: { id: ids },
    attributes: ['id', 'name']
  })
  return locations.map((l) => ({ id: l.id, name: l.name }))
}

const syncCategoryStores = async (categoryId, storeIds, transaction) => {
  if (!(await hasCategoryStoreTable())) return
  const existing = await db.category_store.findAll({
    where: { category: categoryId },
    attributes: ['store'],
    raw: true,
    transaction
  })
  const existingIds = existing.map((r) => r.store)
  const toAdd = storeIds.filter((id) => !existingIds.includes(id))
  const toRemove = existingIds.filter((id) => !storeIds.includes(id))

  if (toAdd.length > 0) {
    await db.category_store.bulkCreate(
      toAdd.map((storeId) => ({ category: categoryId, store: storeId })),
      { transaction }
    )
  }
  if (toRemove.length > 0) {
    await db.category_store.destroy({
      where: { category: categoryId, store: { [Op.in]: toRemove } },
      transaction
    })
  }
}

const getCategoryStoreSubQuery = (storeId) => {
  return db.sequelize.literal(
    `EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND store = ${Number(storeId)} AND "deletedAt" IS NULL)`
  )
}

const getUnassignedCategorySubQuery = () => {
  return db.sequelize.literal(
    `NOT EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND "deletedAt" IS NULL)`
  )
}

// Get Category By Id
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params

    const category = await Category.findByPk(id)

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan'
      })
    }

    // Resolve stores from junction table
    const storeRows = (await hasCategoryStoreTable())
      ? await db.category_store.findAll({
          where: { category: Number(id) },
          attributes: ['store'],
          raw: true
        })
      : []
    const storeIds = storeRows.map((r) => r.store)
    const stores = await resolveStoreNames(storeIds)

    const productCount = await Product.count({ where: { category: id } })

    await enrichAuditFields(db, [category])

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        id: category.id,
        code: `#CAT-${String(category.id).padStart(3, '0')}`,
        name: category.name,
        description: category.description,
        value: category.value,
        image: category.image,
        parentId: category.parentId,
        color: category.color,
        sortOrder: category.sortOrder,
        status: category.status,
        productCount,
        store: stores,
        createdBy: category.createdBy,
        createdByUser: category.dataValues?.createdByUser || null,
        modifiedBy: category.modifiedBy,
        modifiedByUser: category.dataValues?.modifiedByUser || null,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Get All List To Table Cashier List
exports.getAllCategoryInTable = async (req, res) => {
  let {
    page = 1,
    pageSize = req.query.limit || 10,
    status = 'all',
    store,
    search
  } = req.query

  if (!store && req.user?.roleType !== 'super_admin' && req.user?.store) {
    store = req.user.store
  }

  try {
    const offset = (page - 1) * pageSize

    let whereClause = {}
    let statsWhere = {}
    if (status === 'active' || status === 'true') {
      whereClause.status = 'active'
    } else if (status === 'inactive' || status === 'false') {
      whereClause.status = 'inactive'
    }

    if (store) {
      const storeId = parseInt(store)
      if (await hasCategoryStoreTable()) {
        // SuperAdmin: show assigned to store OR unassigned
        // Admin/Cashier: show assigned to store only
        const isSuperAdmin = req.user?.roleType === 'super_admin'
        if (isSuperAdmin) {
          const storeOr = [
            getCategoryStoreSubQuery(storeId),
            getUnassignedCategorySubQuery()
          ]
          whereClause[Op.or] = storeOr
          statsWhere = { [Op.or]: storeOr }
        } else {
          whereClause[Op.and] = [getCategoryStoreSubQuery(storeId)]
          statsWhere = { [Op.and]: [getCategoryStoreSubQuery(storeId)] }
        }
      }
    }

    if (search) {
      const searchClause = [
        { name: { [Op.iLike]: `%${search}%` } },
        { idCategory: { [Op.iLike]: `%${search}%` } }
      ]
      if (whereClause[Op.or]) {
        whereClause[Op.and] = [
          { [Op.or]: whereClause[Op.or] },
          { [Op.or]: searchClause }
        ]
        delete whereClause[Op.or]
      } else if (whereClause[Op.and]) {
        whereClause[Op.and].push({ [Op.or]: searchClause })
      } else {
        whereClause[Op.or] = searchClause
      }
    }

    const [
      categories,
      productCounts,
      totalCategories,
      activeCount,
      inactiveCount,
      draftCount
    ] = await Promise.all([
      Category.findAll({
        where: whereClause,
        limit: parseInt(pageSize),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      }),
      Product.findAll({
        attributes: [
          'category',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
        ],
        group: ['category'],
        raw: true
      }),
      Category.count({ where: statsWhere }),
      Category.count({ where: { ...statsWhere, status: 'active' } }),
      Category.count({ where: { ...statsWhere, status: 'inactive' } }),
      Category.count({ where: { ...statsWhere, status: 'draft' } })
    ])

    await enrichAuditFields(db, categories)

    const countMap = {}
    if (Array.isArray(productCounts)) {
      productCounts.forEach((row) => {
        countMap[row.category] = parseInt(row.count, 10)
      })
    }

    // Resolve store assignments via junction table
    const categoryIds = categories.map((c) => c.id)
    const storeRows =
      categoryIds.length > 0 && (await hasCategoryStoreTable())
        ? await db.category_store.findAll({
            where: { category: { [Op.in]: categoryIds } },
            attributes: ['category', 'store'],
            raw: true
          })
        : []
    const storeIdSet = [...new Set(storeRows.map((r) => r.store))]
    const locationMap = {}
    if (storeIdSet.length > 0) {
      const locations = await Location.findAll({
        where: { id: storeIdSet },
        attributes: ['id', 'name']
      })
      locations.forEach((l) => {
        locationMap[l.id] = l.name
      })
    }
    const categoryStoreMap = {}
    storeRows.forEach((r) => {
      if (!categoryStoreMap[r.category]) categoryStoreMap[r.category] = []
      categoryStoreMap[r.category].push(r.store)
    })

    const data = categories.map((item) => ({
      id: item.id,
      code: `#CAT-${String(item.id).padStart(3, '0')}`,
      name: item.name,
      description: item.description,
      value: item.value,
      image: item.image,
      parentId: item.parentId,
      color: item.color,
      sortOrder: item.sortOrder,
      status: item.status,
      productCount: countMap[item.id] || 0,
      store: (categoryStoreMap[item.id] || []).map((id) => ({
        id,
        name: locationMap[id] || null
      })),
      createdBy: item.createdBy,
      createdByUser: item.dataValues?.createdByUser || null,
      modifiedBy: item.modifiedBy,
      modifiedByUser: item.dataValues?.modifiedByUser || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: data,
      total: totalCategories,
      stats: {
        total: totalCategories,
        active: activeCount,
        inactive: inactiveCount,
        draft: draftCount
      },
      pagination: {
        total: totalCategories,
        totalPages: Math.ceil(totalCategories / pageSize)
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: 'Kategori Tidak Ditemukan'
      })
    }
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Add New Category
exports.addNewCategory = async (req, res) => {
  const body = req.body

  try {
    const findOneCategory = await Category?.findOne({
      where: { name: body?.name }
    })

    if (findOneCategory?.getDataValue) {
      return res.status(403).json({
        success: false,
        message: 'Category Sudah Terdaftar'
      })
    }

    let imageUrl = null
    if (req.file) {
      try {
        const { url } = await uploadToCloudinaryWithDedup(
          req.file.path,
          'pos-app-categories'
        )
        imageUrl = url
      } catch (cloudErr) {
        console.error(
          'Cloudinary upload failed, proceeding without image:',
          cloudErr
        )
        imageUrl = null
      }
    } else if (body.image) {
      imageUrl = body.image
    } else if (body.icon) {
      imageUrl = body.icon
    }

    const status =
      body.status !== undefined
        ? body.status === true
          ? 'active'
          : body.status === false
            ? 'inactive'
            : body.status
        : body.isActive !== undefined
          ? body.isActive
            ? 'active'
            : 'inactive'
          : 'active'

    const parsedStores = body.store
      ? parseStoreField(body.store)
      : req.storeId || req.cookies.store
        ? [parseInt(req.storeId || req.cookies.store, 10)]
        : req.user?.store
          ? [parseInt(req.user.store, 10)]
          : []

    const createdCategory = await Category.create({
      name: body?.name,
      description: body?.description || null,
      image: imageUrl,
      value: body?.value || body?.name?.toLowerCase(),
      parentId: body?.parentId ? parseInt(body.parentId, 10) : null,
      color: body?.color || '#0f172a',
      sortOrder:
        body?.sortOrder !== undefined ? parseInt(body.sortOrder, 10) || 0 : 0,
      status: status,
      createdBy: req.user?.id || null
    })

    if (createdCategory.getDataValue) {
      // Sync junction table
      if (parsedStores.length > 0) {
        await syncCategoryStores(createdCategory.id, parsedStores)
      }

      createAudit(
        req,
        'create',
        'category',
        createdCategory.id,
        `Created category: ${body.name}`
      )

      return res.status(200).json({
        success: true,
        message: 'Category Berhasil Di Buat'
      })
    }
    return res.status(500).json({
      success: false,
      message: 'Gagal Membuat Category'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Edit Category By Id
exports.editCategoryById = async (req, res) => {
  const body = req.body
  try {
    const category = await Category.findByPk(req.params.id)
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan'
      })
    }

    const duplicate = await Category.findOne({
      where: {
        name: body.name,
        id: { [Op.ne]: req.params.id }
      }
    })
    if (duplicate) {
      return res.status(403).json({
        success: false,
        message: 'Kategori Sudah Tersedia'
      })
    }

    let imageUrl = category.image
    if (req.file) {
      try {
        const { url } = await uploadToCloudinaryWithDedup(
          req.file.path,
          'pos-app-categories'
        )
        if (category.image && category.image.startsWith('http')) {
          await deleteFromCloudinary(category.image)
        }
        imageUrl = url
      } catch (cloudErr) {
        console.error('Cloudinary upload failed:', cloudErr)
      }
    } else if (body.image !== undefined) {
      if (category.image && category.image.startsWith('http')) {
        await deleteFromCloudinary(category.image)
      }
      imageUrl = body.image
    } else if (body.icon !== undefined) {
      if (category.image && category.image.startsWith('http')) {
        await deleteFromCloudinary(category.image)
      }
      imageUrl = body.icon
    }

    const status =
      body.status !== undefined
        ? body.status === true
          ? 'active'
          : body.status === false
            ? 'inactive'
            : body.status
        : body.isActive !== undefined
          ? body.isActive
            ? 'active'
            : 'inactive'
          : 'active'

    if (
      body.parentId &&
      parseInt(body.parentId, 10) === parseInt(req.params.id, 10)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Kategori tidak dapat menjadi induk dari dirinya sendiri'
      })
    }

    const [affectedCount, updatedRows] = await Category.update(
      {
        name: body?.name,
        description: body?.description,
        image: imageUrl,
        value: body?.value || body?.name?.toLowerCase(),
        parentId:
          body?.parentId !== undefined
            ? body?.parentId
              ? parseInt(body.parentId, 10)
              : null
            : category.parentId,
        color: body?.color !== undefined ? body?.color : category.color,
        sortOrder:
          body?.sortOrder !== undefined
            ? parseInt(body.sortOrder, 10) || 0
            : category.sortOrder,
        status: status,
        modifiedBy: req.user?.id || null
      },
      {
        returning: true,
        where: { id: req.params.id }
      }
    )

    if (affectedCount === 0) {
      return res.status(500).json({
        success: false,
        message: 'Gagal Ubah Kategori'
      })
    }

    // Sync junction table
    if (body.store !== undefined) {
      const parsedStores = parseStoreField(body.store)
      await syncCategoryStores(Number(req.params.id), parsedStores)
    }

    createAudit(
      req,
      'update',
      'category',
      req.params.id,
      `Updated category: ${body.name}`
    )

    return res.status(200).json({
      success: true,
      message: 'Sukses Ubah Kategori',
      data: updatedRows[0]?.dataValues || null
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Delete Category By Id
exports.deleteCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'ID kategori diperlukan'
      })
    }

    const category = await Category.findByPk(categoryId)

    await Category.sequelize.transaction(async (t) => {
      await Product.update(
        { status: 'inactive' },
        { where: { category: categoryId }, transaction: t }
      )

      const getId = await Category.destroy({
        where: { id: categoryId },
        transaction: t
      })

      if (!getId) {
        throw new Error('Category not found')
      }
    })

    createAudit(
      req,
      'delete',
      'category',
      categoryId,
      `Deleted category: ${category?.name || 'Unknown'}`
    )

    return res.status(200).json({
      success: true,
      message: 'Success Hapus Kategori'
    })
  } catch (error) {
    console.error('Error =>', error)
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Download Excel Template For Category
exports.exportCategory = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['createdAt', 'ASC']]
    })

    const Location = db.location
    const stores = await Location.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    })
    const storeNames = stores.map((s) => s.name)
    const storeDropdown = ['All Stores', ...storeNames].join(',')

    const workbook = new excelJS.Workbook()
    const worksheet = workbook.addWorksheet('Category')

    worksheet.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Store', key: 'store', width: 20 },
      { header: 'isActive', key: 'isActive', width: 12 }
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

    const storeNameById = {}
    stores.forEach((s) => {
      storeNameById[s.id] = s.name
    })

    // Resolve store assignments via junction table
    const categoryIds = categories.map((c) => c.id)
    const storeRows =
      categoryIds.length > 0 && (await hasCategoryStoreTable())
        ? await db.category_store.findAll({
            where: { category: { [Op.in]: categoryIds } },
            attributes: ['category', 'store'],
            raw: true
          })
        : []
    const categoryStoreMap = {}
    storeRows.forEach((r) => {
      if (!categoryStoreMap[r.category]) categoryStoreMap[r.category] = []
      categoryStoreMap[r.category].push(r.store)
    })

    const formatStores = (categoryId) => {
      const storeIds = categoryStoreMap[categoryId] || []
      if (storeIds.length === 0) return 'All Stores'
      return storeIds
        .map((id) => storeNameById[id] || `Store #${id}`)
        .join(', ')
    }

    let rowIndex = 2
    categories.forEach((cat) => {
      const no = rowIndex - 1
      worksheet.getCell(`A${rowIndex}`).value = no
      worksheet.getCell(`A${rowIndex}`).protection = { locked: true }
      worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'center' }

      worksheet.getCell(`B${rowIndex}`).value = cat.name
      worksheet.getCell(`B${rowIndex}`).protection = { locked: false }

      worksheet.getCell(`C${rowIndex}`).value = cat.description || ''
      worksheet.getCell(`C${rowIndex}`).protection = { locked: false }

      worksheet.getCell(`D${rowIndex}`).value = formatStores(cat.id)
      worksheet.getCell(`D${rowIndex}`).protection = { locked: false }
      worksheet.getCell(`D${rowIndex}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${storeDropdown}"`]
      }

      worksheet.getCell(`E${rowIndex}`).value =
        cat.status === 'active' ? 'Active' : 'Non-Active'
      worksheet.getCell(`E${rowIndex}`).protection = { locked: false }
      worksheet.getCell(`E${rowIndex}`).dataValidation = {
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
      ;['B', 'C', 'D', 'E'].forEach((col) => {
        worksheet.getCell(`${col}${row}`).protection = { locked: false }
      })

      worksheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${storeDropdown}"`]
      }

      worksheet.getCell(`E${row}`).dataValidation = {
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
      'attachment; filename=category-template.xlsx'
    )

    return res.send(buffer)
  } catch (err) {
    console.error('Error writing Excel file: ', err)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Download Category Data (clean export)
exports.downloadData = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['createdAt', 'ASC']]
    })

    const workbook = new excelJS.Workbook()
    const worksheet = workbook.addWorksheet('Category')

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
      { header: 'isActive', key: 'isActive', width: 12 }
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

    categories.forEach((cat) => {
      worksheet.addRow({
        id: cat.id,
        name: cat.name,
        description: cat.description || '',
        value: cat.value || '',
        isActive: cat.status === 'active' ? 'TRUE' : 'FALSE'
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=category-data.xlsx'
    )

    return res.send(buffer)
  } catch (err) {
    console.error('Error writing Excel file: ', err)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Upload Excel Category
exports.importCategory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada file yang diupload'
      })
    }

    const workbook = new excelJS.Workbook()
    await workbook.xlsx.load(req.file.buffer)

    const worksheet = workbook.getWorksheet('Category')
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'Sheet "Category" tidak ditemukan'
      })
    }

    const headers = []
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value ? cell.value.toString().trim() : '')
    })

    const EXPECTED = ['No', 'Name', 'Description', 'Store', 'isActive']
    const isValid = EXPECTED.every((h, i) => headers[i] === h)
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Header tidak valid. Pastikan menggunakan template yang benar'
      })
    }

    const Location = db.location
    const stores = await Location.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name']
    })
    const storeByName = {}
    stores.forEach((s) => {
      storeByName[s.name] = s.id
    })

    const categories = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 2) return

      const name = row.getCell(2).value
      if (!name) {
        return
      }

      const description = row.getCell(3).value
        ? String(row.getCell(3).value).trim()
        : null

      const storeCell = row.getCell(4).value
      const storeName = storeCell ? String(storeCell).trim() : ''
      const isAllStores = [
        '',
        'all stores',
        'pilih semua',
        'semua toko'
      ].includes(storeName.toLowerCase())
      const storeId = isAllStores ? null : storeByName[storeName] || null

      const isActiveCell = row.getCell(5).value
      let status = 'active'
      if (isActiveCell !== null && isActiveCell !== undefined) {
        const strVal = String(isActiveCell).toLowerCase().trim()
        if (strVal === 'draft') {
          status = 'draft'
        } else if (
          strVal === 'true' ||
          strVal === '1' ||
          strVal === 'yes' ||
          strVal === 'active'
        ) {
          status = 'active'
        } else {
          status = 'inactive'
        }
      }

      const nameStr = String(name).trim()
      categories.push({
        name: nameStr,
        description,
        storeId,
        status,
        createdBy: req.user?.id || null
      })
    })

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Terdapat kesalahan pada data',
        errors
      })
    }

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data yang valid untuk diupload'
      })
    }

    let insertedCount = 0
    const duplicateErrors = []

    for (const cat of categories) {
      const existing = await Category.findOne({
        where: { name: cat.name }
      })

      if (existing) {
        duplicateErrors.push(`Kategori "${cat.name}" sudah terdaftar`)
        continue
      }

      const newCategory = await Category.create({
        name: cat.name,
        description: cat.description,
        status: cat.status,
        createdBy: cat.createdBy
      })

      // Create junction rows
      if (cat.storeId && (await hasCategoryStoreTable())) {
        await db.category_store.create({
          category: newCategory.id,
          store: cat.storeId
        })
      }

      insertedCount++
    }

    createAudit(
      req,
      'import',
      'category',
      null,
      `Imported ${insertedCount} categories`
    )

    return res.status(201).json({
      success: true,
      message: `Berhasil upload ${insertedCount} dari ${categories.length} kategori`,
      data: {
        total: categories.length,
        created: insertedCount,
        skipped: duplicateErrors.length,
        skippedNames: duplicateErrors.length > 0 ? duplicateErrors : undefined
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
