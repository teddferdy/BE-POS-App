const db = require('../../db/models')
const { Op } = require('sequelize')
const Category = db.category
const Product = db.product
const excelJS = require('exceljs')
const {
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')

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

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        value: category.value,
        image: category.image,
        status: category.status,
        store: category.store,
        createdBy: category.createdBy,
        modifiedBy: category.modifiedBy,
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
  const { page = 1, pageSize = 10, status = 'all' } = req.query

  try {
    const offset = (page - 1) * pageSize

    let whereClause = {}
    if (status === 'active' || status === 'true') {
      whereClause.status = 'active'
    } else if (status === 'inactive' || status === 'false') {
      whereClause.status = 'inactive'
    }

    const [categories, productCounts, totalCategories, activeCount, inactiveCount] = await Promise.all([
      Category.findAll({
        where: whereClause,
        limit: parseInt(pageSize),
        offset: parseInt(offset)
      }),
      Product.findAll({
        attributes: ['category', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
        group: ['category'],
        raw: true
      }),
      Category.count({}),
      Category.count({ where: { status: 'active' } }),
      Category.count({ where: { status: 'inactive' } })
    ])

    const countMap = {}
    if (Array.isArray(productCounts)) {
      productCounts.forEach((row) => {
        countMap[row.category] = parseInt(row.count, 10)
      })
    }

    const data = categories.map((item) => ({
      id: item.id,
      code: `#CAT-${String(item.id).padStart(3, '0')}`,
      name: item.name,
      description: item.description,
      value: item.value,
      image: item.image,
      status: item.status,
      productCount: countMap[item.id] || 0,
      store: item.store,
      createdBy: item.createdBy,
      modifiedBy: item.modifiedBy,
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
        inactive: inactiveCount
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
        console.error('Cloudinary upload failed, proceeding without image:', cloudErr)
        imageUrl = null
      }
    } else if (body.image) {
      imageUrl = body.image
    } else if (body.icon) {
      imageUrl = body.icon
    }

    const status = body.isActive !== undefined ? (body.isActive ? 'active' : 'inactive') : (body.status !== undefined ? (body.status === true ? 'active' : body.status === false ? 'inactive' : body.status) : 'active')

    const createdCategory = await Category.create({
      name: body?.name,
      description: body?.description || null,
      image: imageUrl,
      value: body?.value || body?.name?.toLowerCase(),
      status: status,
      createdBy: body.createdBy
    })

    if (createdCategory.getDataValue) {
      createAudit(req, 'create', 'category', createdCategory.id, `Created category: ${body.name}`)

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

    const status = body.isActive !== undefined ? (body.isActive ? 'active' : 'inactive') : (body.status !== undefined ? (body.status === true ? 'active' : body.status === false ? 'inactive' : body.status) : 'active')

    const [affectedCount, updatedRows] = await Category.update(
      {
        name: body?.name,
        description: body?.description,
        image: imageUrl,
        value: body?.value || body?.name?.toLowerCase(),
        status: status,
        modifiedBy: body?.modifiedBy
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

    createAudit(req, 'update', 'category', req.params.id, `Updated category: ${body.name}`)

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
  const body = req.body

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

    createAudit(req, 'delete', 'category', categoryId, `Deleted category: ${category?.name || 'Unknown'}`)

    return res.status(200).json({
      success: true,
      message: 'Success Hapus Kategori'
    })
  } catch (error) {
    console.error('Error =>', error)
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
      order: [['createdAt', 'DESC']]
    })

    const workbook = new excelJS.Workbook()
    const worksheet = workbook.addWorksheet('Category')

    worksheet.columns = [
      { header: 'No', key: 'no', width: 8 },
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

      worksheet.getCell(`C${rowIndex}`).value = cat.description || ''
      worksheet.getCell(`C${rowIndex}`).protection = { locked: false }

      worksheet.getCell(`D${rowIndex}`).value = cat.value || ''
      worksheet.getCell(`D${rowIndex}`).protection = { locked: false }

      worksheet.getCell(`E${rowIndex}`).value = cat.status === 'active' ? 'TRUE' : 'FALSE'
      worksheet.getCell(`E${rowIndex}`).protection = { locked: false }

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
    res.setHeader('Content-Disposition', 'attachment; filename=category-template.xlsx')

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
      order: [['createdAt', 'DESC']]
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
    res.setHeader('Content-Disposition', 'attachment; filename=category-data.xlsx')

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

    const EXPECTED = ['No', 'Name', 'Description', 'Value', 'isActive']
    const isValid = EXPECTED.every((h, i) => headers[i] === h)
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Header tidak valid. Pastikan menggunakan template yang benar'
      })
    }

    const categories = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 2) return

      const name = row.getCell(2).value
      if (!name) {
        return
      }

      const description = row.getCell(3).value ? String(row.getCell(3).value).trim() : null
      const value = row.getCell(4).value ? String(row.getCell(4).value).trim() : String(name).toLowerCase()
      const isActiveCell = row.getCell(5).value
      let isActive = true
      if (isActiveCell !== null && isActiveCell !== undefined) {
        const strVal = String(isActiveCell).toLowerCase().trim()
        isActive = strVal === 'true' || strVal === '1' || strVal === 'yes'
      }

      const nameStr = String(name).trim()
      categories.push({
        name: nameStr,
        description,
        value: value || nameStr.toLowerCase(),
        status: isActive ? 'active' : 'inactive',
        createdBy: req.user?.userName || req.user?.id || 'system'
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
        where: {
          name: cat.name,
          store: cat.store
        }
      })

      if (existing) {
        duplicateErrors.push(`Kategori "${cat.name}" sudah terdaftar`)
        continue
      }

      await Category.create(cat)
      insertedCount++
    }

    createAudit(req, 'import', 'category', null, `Imported ${insertedCount} categories`)

    return res.status(201).json({
      success: true,
      message: `Berhasil upload ${insertedCount} dari ${categories.length} kategori`,
      data: {
        total: categories.length,
        inserted: insertedCount,
        duplicates: duplicateErrors.length,
        errors: duplicateErrors.length > 0 ? duplicateErrors : undefined
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
