const db = require('../../db/models')
const TypePayment = db.type_payment
const { createAudit } = require('../../utils/auditLog')

exports.getAllTypePaymentByLocationAndActive = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, limit = 10 } = req.query

  try {
    const offset = (page - 1) * limit

    const { rows: typePayment, count } = await TypePayment.findAndCountAll({
      where: {
        ...(store ? { store } : {}),
        status: 'active'
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

    if (status === 'active' || status === 'true') {
      queryConditions.status = 'active'
    } else if (status === 'inactive' || status === 'false') {
      queryConditions.status = 'inactive'
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
  const { name, status, createdBy } = req.body
  const store = req.body.store || req.user?.store
  try {
    const findOneTypePayment = await TypePayment?.findOne({
      where: {
        name: name,
        ...(store ? { store } : {})
      }
    })

    if (!findOneTypePayment) {
      const postData = await TypePayment.create({
        name: name,
        store: store,
        status: status !== undefined ? (status === true ? 'active' : status === false ? 'inactive' : status) : 'active',
        createdBy: createdBy
      })
      createAudit(req, 'create', 'type_payment', postData.id, 'Created type_payment: ' + (postData.name || postData.id))
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
          ...(store ? { store } : {})
        }
      })

      if (!getDuplicate || getDuplicate.id === parseInt(req.params.id)) {
        const editTypePayment = await TypePayment?.update(
          {
            name: body.name,
            status: body.status !== undefined ? (body.status === true ? 'active' : body.status === false ? 'inactive' : body.status) : 'active',
            modifiedBy: body?.modifiedBy
          },
          {
            returning: true,
            where: {
              id: req.params.id,
              ...(store ? { store } : {})
            }
          }
        ).then(([_, data]) => {
          return data
        })
      createAudit(req, 'update', 'type_payment', req.params.id, 'Updated type_payment: ' + req.params.id)

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
        id: req.params.id,
        ...(store ? { store } : {})
      }
    })
    createAudit(req, 'delete', 'type_payment', req.params.id, 'Deleted type_payment: ' + req.params.id)

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