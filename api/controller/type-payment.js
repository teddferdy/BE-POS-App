const db = require('../../db/models')
const TypePayment = db.type_payment

exports.getAllTypePaymentByLocationAndActive = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, limit = 10 } = req.query

  try {
    const offset = (page - 1) * limit

    const { rows: typePayment, count } = await TypePayment.findAndCountAll({
      where: {
        ...(store ? { store } : {}),
        status: true
      },
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data:
        typePayment?.length > 0
          ? typePayment?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : [],
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit)
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllTypePayment = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, pageSize = 10, status } = req.query

  try {
    const offset = (page - 1) * pageSize

    const queryConditions = store ? { store } : {}

    if (status === 'true') {
      queryConditions.status = true
    } else if (status === 'false') {
      queryConditions.status = false
    }

    const subCategory = await TypePayment.findAll({
      where: queryConditions,
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    })

    const totalTypePayments = await TypePayment.count({
      where: queryConditions
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data:
        subCategory?.length > 0
          ? subCategory?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalTypePayments,
        totalPages: Math.ceil(totalTypePayments / pageSize)
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

exports.postNewTypePayment = async (req, res) => {
  const { name, description, status, createdBy } = req.body
  const store = req.body.store || req.user?.store
  try {
    const findOneTypePayment = await TypePayment?.findOne({
      where: {
        description: description,
        ...(store ? { store } : {})
      }
    })

    if (!findOneTypePayment?.getDataValue) {
      const postData = await TypePayment.create({
        name: name,
        description: description,
        store: store,
        status: status,
        createdBy: createdBy
      })
      return res.status(200).json({
        success: true,
        message: 'Success',
        data: postData
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'TypePayment Sudah Terdaftar'
      })
    }
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editTypePaymentById = async (req, res) => {
    const body = req.body
    const store = body.store || req.user?.store
    try {
      const getDuplicate = await TypePayment.findOne({
        where: {
          name: body.name,
          description: body.description,
          ...(store ? { store } : {}),
          status: body.status
        }
      })

      if (
        !getDuplicate?.dataValues ||
        !getDuplicate?.dataValues?.status === body?.status
      ) {
        const editTypePayment = await TypePayment?.update(
          {
            name: body.name,
            description: body.description,
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
        message: 'Sukses Ubah TypePayment',
        data: editTypePayment?.dataValues
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'TypePayment Sudah Tersedia'
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteTypePaymentById = async (req, res) => {
  const body = req.body

  try {
    const store = body.store || req.user?.store
    const getId = await TypePayment.destroy({
      where: {
        id: body.id,
        description: body.description,
        ...(store ? { store } : {})
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus TypePayment'
      })
    } else {
      return res.status(403).json({
        success: false,
        message: 'Hapus TypePayment Gagal'
      })
    }
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}