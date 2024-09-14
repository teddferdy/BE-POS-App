/* eslint-disable no-unused-vars */
const TypePayment = require('../../db/models/type_payment')

// Get All Sub-category
exports.getAllTypePayment = async (req, res, next) => {
  try {
    const typePayment = await TypePayment.findAll()

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
  }
}

// Post New SUb Category
exports.postNewTypePayment = async (req, res, next) => {
  const { name, description, status, createdBy } = req.body
  try {
    const findOneTypePayment = await TypePayment?.findOne({
      where: {
        name: name
      }
    })

    if (!findOneTypePayment?.getDataValue) {
      const postData = await TypePayment.create({
        name: name,
        description: description,
        status: status,
        createdBy: createdBy
      })

      if (postData.getDataValue) {
        return res.status(200).json({
          message: 'success'
        })
      }
    } else {
      return res.status(403).json({
        message: 'Tipe Pembayaran Sudah Terdaftar'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Edit Sub Category By ID
exports.editTypePaymentById = async (req, res, next) => {
  const { id, name, description, status, createdBy, modifiedBy } = req.body
  try {
    const getDuplicate = await TypePayment.findOne({
      where: {
        name: name
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === status
    ) {
      const editTypePayment = await TypePayment?.update(
        {
          id: id,
          name: name,
          description: description,
          status: status,
          createdBy: createdBy,
          modifiedBy: modifiedBy
        },
        {
          returning: true,
          where: {
            id: id
          }
        }
      ).then(([_, data]) => {
        return data
      })

      return res.status(200).json({
        message: 'success',
        data: editTypePayment?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Tipe Pembayaran Sudah Tersedia'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteTypePaymentById = async (req, res, next) => {
  const { id, name } = req.body

  try {
    const getId = await TypePayment.destroy({
      where: {
        id: id,
        name: name
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Tipe Pembayaran'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Tipe Pembayaran Gagal'
      })
    }
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
