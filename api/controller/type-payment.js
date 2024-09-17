/* eslint-disable no-unused-vars */
const TypePayment = require('../../db/models/type_payment')

// Get All TypePayment
exports.getAllTypePayment = async (req, res, next) => {
  try {
    const subCategory = await TypePayment.findAll()
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
    // conne
  }
}

// Post New Type Category
exports.postNewTypePayment = async (req, res, next) => {
  try {
    const { description, percentage, status, createdBy } = req.body
    const findOneTypePayment = await TypePayment?.findOne({
      where: {
        description: description
      }
    })

    if (!findOneTypePayment?.getDataValue) {
      const numbPercent = percentage.replace('%', '')
      const postData = await TypePayment.create({
        description: description,
        percentage: parseFloat(numbPercent) / 100.0,
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
        percentage: parseFloat(numbPercent) / 100.0
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
            id: body.id
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
  }
}

// Delete TypePayment By Id
exports.deleteTypePaymentById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await TypePayment.destroy({
      where: {
        id: body.id,
        description: body.description
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
  }
}
