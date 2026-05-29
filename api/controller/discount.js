const db = require('../../db/models')
const Discount = db.discount

exports.getAllDiscountByLocationAndActive = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, size = 10 } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  try {
    const { count, rows: subCategory } = await Discount.findAndCountAll({
      where: {
        ...(store ? { store } : {}),
        status: true
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
                ...items?.dataValues
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
  const store = req.query.store || req.user?.store
  const { page = 1, size = 10, status = 'all' } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  let whereCondition = store ? { store } : {}

  if (status === 'true') {
    whereCondition.status = true
  } else if (status === 'false') {
    whereCondition.status = false
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
                ...items?.dataValues
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
  const { name, type, value, minimumOrder, maximumDiscount, startDate, endDate, status, createdBy } = req.body
  const store = req.body.store || req.user?.store
  try {
    const discountType = type === 'percentage' ? 'percent' : type

    const findOneDiscount = await Discount?.findOne({
      where: {
        name: name,
        ...(store ? { store } : {})
      }
    })

    if (!findOneDiscount) {
      const postData = await Discount.create({
        name,
        type: discountType || 'percent',
        value: parseInt(value),
        minimumOrder: minimumOrder || 0,
        maximumDiscount: maximumDiscount || 0,
        startDate,
        endDate,
        store,
        status: status !== undefined ? status : true,
        createdBy
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
  const store = body.store || req.user?.store
  try {
    const getDuplicate = await Discount.findOne({
      where: {
        name: body.name,
        ...(store ? { store } : {})
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status
    ) {
      const editDiscount = await Discount?.update(
        {
          name: body.name,
          type: body.type,
          value: parseInt(body.value),
          minimumOrder: body.minimumOrder,
          maximumDiscount: body.maximumDiscount,
          startDate: body.startDate,
          endDate: body.endDate,
          status: body.status,
          createdBy: body.createdBy,
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
    const store = body.store || req.user?.store
    const getId = await Discount.destroy({
      where: {
        id: body.id,
        ...(store ? { store } : {})
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