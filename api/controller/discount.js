/* eslint-disable no-unused-vars */
const Discount = require('../../db/models/discount')

// Get All Discount
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
    const findOneDiscount = await Discount?.findOne({
      where: {
        nameStore: description
      }
    })

    if (!findOneDiscount?.getDataValue) {
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
    } else {
      return res.status(403).json({
        message: 'Discount Sudah Terdaftar'
      })
    }
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Edit Discount By Id
exports.editDiscountById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await Discount.findOne({
      where: {
        description: body.description
      }
    })

    if (!getDuplicate?.dataValues) {
      const numbPercent = body.percentage.replace('%', '')
      const editDiscount = await Discount?.update(
        {
          description: body.description,
          percentage: parseFloat(numbPercent) / 100.0,
          isActive: body.isActive,
          createdBy: body.createdBy,
          modifiedBy: body?.modifiedBy
        },
        {
          returning: true,
          where: {
            id: body.id
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        message: 'Sukses Ubah Discount',
        data: editDiscount?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Discount Sudah Tersedia'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Delete Discount By Id
exports.deleteDiscountById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Location.destroy({
      where: {
        id: body.id,
        description: body.description
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Discount'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Discount Gagal'
      })
    }
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
