/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const TypePayment = require('../../db/models/type_payment')

// Get Type Payment By Store And Active
exports.getAllTypePaymentByLocationAndActive = async (req, res, next) => {
  const { store } = req.query
  try {
    const typePayment = await TypePayment.findAll({
      where: {
        store: store,
        status: true
      }
    })
    return res.status(200).json({
      message: 'Success',
      data:
        typePayment?.length > 0
          ? typePayment?.map((items) => {
              return {
                ...items?.dataValues
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

// Get All TypePayment
exports.getAllTypePayment = async (req, res, next) => {
  const { store } = req.query
  try {
    const subCategory = await TypePayment.findAll({
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
                ...items?.dataValues
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

// Post New Type Category
exports.postNewTypePayment = async (req, res, next) => {
  const { description, percentage, status, createdBy, store } = req.body
  try {
    const findOneTypePayment = await TypePayment?.findOne({
      where: {
        description: description,
        store: store
      }
    })

    if (!findOneTypePayment?.getDataValue) {
      const numbPercent = percentage.replace('%', '')
      const postData = await TypePayment.create({
        description: description,
        percentage: parseFloat(numbPercent) / 100.0,
        store: store,
        status: status,
        createdBy: createdBy
      })
      return res.status(200).json({
        status: 'success',
        data: postData
      })
    } else {
      return res.status(403).json({
        message: 'TypePayment Sudah Terdaftar'
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

// Edit TypePayment By Id
exports.editTypePaymentById = async (req, res, next) => {
  const body = req.body
  const numbPercent = body.percentage.replace('%', '')
  try {
    const getDuplicate = await TypePayment.findOne({
      where: {
        description: body.description,
        percentage: parseFloat(numbPercent) / 100.0,
        store: body.store
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status
    ) {
      const editTypePayment = await TypePayment?.update(
        {
          description: body.description,
          percentage: parseFloat(numbPercent) / 100.0,
          status: body.status,
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
        message: 'Sukses Ubah TypePayment',
        data: editTypePayment?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'TypePayment Sudah Tersedia'
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

// Delete TypePayment By Id
exports.deleteTypePaymentById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await TypePayment.destroy({
      where: {
        id: body.id,
        description: body.description,
        store: body.store
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus TypePayment'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus TypePayment Gagal'
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
