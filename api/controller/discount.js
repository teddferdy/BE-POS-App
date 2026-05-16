const db = require('../../db/models')
const Discount = db.discount

exports.getAllDiscountByLocationAndActive = async (req, res) => {
  const { store, page = 1, size = 10 } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  try {
    const { count, rows: subCategory } = await Discount.findAndCountAll({
      where: {
        store: store,
        isActive: true
      },
      limit: limit,
      offset: offset
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
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
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllDiscount = async (req, res) => {
  const { store, page = 1, size = 10, status = 'all' } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  let whereCondition = { store: store }

  if (status === 'true') {
    whereCondition.isActive = true
  } else if (status === 'false') {
    whereCondition.isActive = false
  }

  try {
    const { count, rows: subCategory } = await Discount.findAndCountAll({
      where: whereCondition,
      limit: limit,
      offset: offset
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
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
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.postNewDiscount = async (req, res) => {
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
        success: true,
        message: 'Success',
        data: postData
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Discount Sudah Terdaftar'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editDiscountById = async (req, res) => {
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
        success: true,
        message: 'Sukses Ubah Discount',
        data: editDiscount?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Discount Sudah Tersedia'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteDiscountById = async (req, res) => {
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
        success: true,
        message: 'Success Hapus Discount'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Hapus Discount Gagal'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}