/* eslint-disable no-unused-vars */
const SubCategoryProduct = require('../../db/models/sub_category')

// Post New SUb Category
exports.postNewSubCategory = async (req, res, next) => {
  try {
    const {
      parentCategory,
      nameSubCategory,
      typeSubCategory,
      isMultiple,
      createdBy
    } = req.body

    const postData = await SubCategoryProduct.create({
      parentCategory: parentCategory,
      nameSubCategory: nameSubCategory,
      typeSubCategory: typeSubCategory,
      isMultiple: isMultiple,
      createdBy: createdBy
    })

    return res.status(200).json({
      status: 'success',
      data: postData
    })
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Get Sub Category By idCategory
exports.getSubCategory = async () => {}
