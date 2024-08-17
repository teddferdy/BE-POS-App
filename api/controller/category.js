/* eslint-disable no-unused-vars */
const Category = require('../../db/models/category')

// Get All List
exports.getAllCategory = async (req, res, next) => {
  try {
    console.log('getAllCategory', req)
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Add New Category
exports.addNewCategory = async (req, res, next) => {
  const body = req.body

  try {
    const findOneCategory = await Category?.findOne({
      where: {
        name: body?.name
      }
    })

    if (!findOneCategory?.getDataValue) {
      const creadtedCategory = await Category.create({
        name: body.name,
        value: body.value,
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
  }
}

// Edit Category By Id
exports.editCategoryById = async (req, res, next) => {
  try {
    console.log('editCategoryById', req)
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Delete Category By Id
exports.deleteCategoryById = async (req, res, next) => {
  try {
    console.log('deleteCategoryById =>', req)
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
