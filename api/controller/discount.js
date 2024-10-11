/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const Discount = require('../../db/models/discount')

// Get All Discount
exports.getAllDiscount = async (req, res, next) => {
  const { store } = req.query
  try {
    const subCategory = await Discount.findAll({
      where: {
        store: store
      }
    })
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
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Post New SUb Category
exports.postNewDiscount = async (req, res, next) => {
  const { description, percentage, isActive, createdBy, store } = req.body
  try {
    const findOneDiscount = await Discount?.findOne({
      where: {
        description: description,
        store: store
      }
    })

    if (!findOneDiscount?.getDataValue) {
      const numbPercent = percentage.replace('%', '')
      const postData = await Discount.create({
        description: description,
        percentage: parseFloat(numbPercent) / 100.0,
        store: store,
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
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Edit Discount By Id
exports.editDiscountById = async (req, res, next) => {
  const body = req.body
  const numbPercent = body.percentage.replace('%', '')
  try {
    const getDuplicate = await Discount.findOne({
      where: {
        description: body.description,
        percentage: parseFloat(numbPercent) / 100.0,
        store: body.store
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.isActive === body?.isActive
    ) {
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
            id: body.id,
            store: body.store
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
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Delete Discount By Id
exports.deleteDiscountById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Discount.destroy({
      where: {
        id: body.id,
        description: body.description,
        store: body.store
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
  } finally {
    console.log('resEND')
    return res.end()
  }
}
