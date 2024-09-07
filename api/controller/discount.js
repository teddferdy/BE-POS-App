/* eslint-disable no-unused-vars */
const Discount = require('../../db/models/discount')

// Get All Sub-category
exports.getAllDiscount = async (req, res, next) => {
  try {
    const subCategory = await Discount.findAll()
    return res.status(200).json({
      message: 'Success',
      data:
        subCategory?.length > 0
          ? subCategory?.map((items) => {
              return {
                ...items?.dataValues,
                percentage: `${Math.round(items.dataValues.percentage * 100)}%`
              }
            })
          : []
    })
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Post New SUb Category
exports.postNewDiscount = async (req, res, next) => {
  try {
    const { description, percentage, isActive, createdBy } = req.body
    const numbPercent = percentage.replace('%', '')
    const postData = await Discount.create({
      description: description,
      percentage: parseFloat(numbPercent) / 100.0,
      isActive: isActive,
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
