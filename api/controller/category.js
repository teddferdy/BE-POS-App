const db = require('../../db/models')
const Category = db.category
const excelJS = require('exceljs')
const fs = require('fs')

// Get All List To Cashier List
exports.getAllCategory = async (req, res) => {
  const store = req.query.store || req.user?.store
  try {
    const getAllCategory = await Category.findAll({
      where: {
        status: true,
        ...(store ? { store } : {})
      }
    }).then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllCategory?.length > 0 ? getAllCategory : []
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
  const store = req.query.store || req.user?.store

  try {
    const offset = (page - 1) * pageSize

    let whereClause = {}
    if (status === 'true') {
      whereClause.status = true
    } else if (status === 'false') {
      whereClause.status = false
    }

    if (store) whereClause.store = store

    const getAllCategory = await Category.findAll({
      where: whereClause,
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    }).then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    const totalCategories = await Category.count({
      where: store ? { store } : {}
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllCategory?.length > 0 ? getAllCategory : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalCategories,
        totalPages: Math.ceil(totalCategories / pageSize)
      }
    })
  } catch (error) {
    console.error('ERROR =>', error)
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
    const store = body.store || req.user?.store
    const findOneCategory = await Category?.findOne({
      where: {
        name: body?.name,
        ...(store ? { store } : {})
      }
    })

    if (!findOneCategory?.getDataValue) {
      const creadtedCategory = await Category.create({
        name: body?.name,
        value: body?.name?.toLowerCase(),
        store: store,
        status: body.status,
        createdBy: body.createdBy
      })

      if (creadtedCategory.getDataValue) {
        return res.status(200).json({
          success: true,
          message: 'Category Berhasil Di Buat'
        })
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Category Sudah Terdaftar'
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
    const store = body.store || req.user?.store
    const getDuplicate = await Category.findOne({
      where: {
        name: body.name,
        ...(store ? { store } : {})
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status
    ) {
      const editCategory = await Category?.update(
        {
          id: body?.id,
          name: body?.name,
          value: body?.name?.toLowerCase(),
          status: body?.status,
          createdBy: body?.createdBy,
          modifiedBy: body?.modifiedBy
        },
        {
          returning: true,
          where: {
            id: body.id,
            ...(store ? { store } : {})
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah Kategori',
        data: editCategory?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Kategori Sudah Tersedia'
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
    const store = body.store || req.user?.store
    const getId = await Category.destroy({
      where: {
        id: body.id,
        name: body.name,
        ...(store ? { store } : {})
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Kategori'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Gagal Hapus Kategori'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Download Excel Template By Excel
exports.exportCategory = async (req, res) => {
  const workbook = new excelJS.Workbook() // Create a new workbook
  const worksheet = workbook.addWorksheet('Category') // New Worksheet
  const path = './files' // Path to download excel

  const fs = require('fs')
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path)
  }

  // Column for data in excel. key must match data key
  worksheet.columns = [
    { header: 'No.', key: 's_no', width: 10 },
    { header: 'Category', key: 'category', width: 20 }
  ]

  // Making first line in excel bold
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
  })

  try {
    // Write to buffer instead of saving to file
    const buffer = await workbook.xlsx.writeBuffer()

    // Set the correct headers for Excel
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', 'attachment; filename=category.xlsx')

    // Send the buffer as a response
    res.send(buffer)
  } catch (err) {
    console.error('Error writing Excel file: ', err)
    res.send({
      status: 'error',
      message: 'Something went wrong',
      error: err.message
    })
  }
}
