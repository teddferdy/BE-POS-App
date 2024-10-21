/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Category = require('../../db/models/category')

// Get All List To Cashier List
exports.getAllCategory = async (req, res, next) => {
  const { store } = req.query
  try {
    const getAllCategory = await Category.findAll({
      where: {
        status: true,
        store: store
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
      message: 'Success',
      data: getAllCategory?.length > 0 ? getAllCategory : []
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Get All List To Table Cashier List
exports.getAllCategoryInTable = async (req, res, next) => {
  const { store, page = 1, pageSize = 10, status = 'all' } = req.query // Default values: page = 1, pageSize = 10

  try {
    const offset = (page - 1) * pageSize // Calculate offset for pagination

    let whereClause = {}
    if (status === 'true') {
      whereClause.status = true
    } else if (status === 'false') {
      whereClause.status = false
    }

    whereClause.store = store

    const getAllCategory = await Category.findAll({
      where: whereClause,
      limit: parseInt(pageSize), // Limit number of results
      offset: parseInt(offset) // Offset based on the current page
    }).then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    // Get the total count of categories for the store to include in the response
    const totalCategories = await Category.count({
      where: { store: store }
    })

    return res.status(200).json({
      message: 'Success',
      data: getAllCategory?.length > 0 ? getAllCategory : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalCategories, // Total number of items
        totalPages: Math.ceil(totalCategories / pageSize) // Calculate total pages
      }
    })
  } catch (error) {
    console.log('ERROR =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Add New Category
exports.addNewCategory = async (req, res, next) => {
  const body = req.body

  try {
    const findOneCategory = await Category?.findOne({
      where: {
        name: body?.name,
        store: body?.store
      }
    })

    if (!findOneCategory?.getDataValue) {
      const creadtedCategory = await Category.create({
        name: body?.name,
        value: body?.name?.toLowerCase(),
        store: body?.store,
        status: body.status,
        createdBy: body.createdBy
      })

      if (creadtedCategory.getDataValue) {
        return res.status(200).json({
          message: 'Category Berhasil Di Buat'
        })
      }
    } else {
      return res.status(403).json({
        message: 'Category Sudah Terdaftar'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Edit Category By Id
exports.editCategoryById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await Category.findOne({
      where: {
        name: body.name,
        store: body?.store
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
            store: body?.store
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        message: 'Sukses Ubah Kategori',
        data: editCategory?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Kategori Sudah Tersedia'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Delete Category By Id
exports.deleteCategoryById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Category.destroy({
      where: {
        id: body.id,
        name: body.name,
        store: body?.store
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Kategori'
      })
    } else {
      return res.status(403).json({
        message: 'Gagal Hapus Kategori'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}
