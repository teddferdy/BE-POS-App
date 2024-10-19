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
  const { store, page = 1, pageSize = 10 } = req.query // Default page = 1, pageSize = 10

  try {
    const offset = (page - 1) * pageSize // Calculate offset for pagination

    // Fetch type payments with pagination
    const subCategory = await TypePayment.findAll({
      where: {
        store: store
      },
      limit: parseInt(pageSize), // Limit the number of results per page
      offset: parseInt(offset) // Offset based on the current page
    })

    // Get the total count of type payments for pagination
    const totalTypePayments = await TypePayment.count({
      where: { store: store }
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
          : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalTypePayments, // Total number of payment types
        totalPages: Math.ceil(totalTypePayments / pageSize) // Total pages
      }
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
  const { name, description, store, status, createdBy } = req.body
  try {
    const findOneTypePayment = await TypePayment?.findOne({
      where: {
        description: description,
        store: store
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
  try {
    const getDuplicate = await TypePayment.findOne({
      where: {
        name: body.name,
        description: body.description,
        store: body.store,
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
