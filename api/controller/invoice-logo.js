/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const InvoiceLogo = require('../../db/models/invoice_logo')
const { Op } = require('sequelize')

// Get Logo Using To Invoice
exports.getInvoiceLogoByIsActive = async (req, res, next) => {
  try {
    const invoiceLogo = await InvoiceLogo.findAll({
      where: {
        isActive: true
      }
    })
    return res.status(200).json({
      message: 'Success',
      data:
        invoiceLogo?.length > 0
          ? invoiceLogo?.map((items) => {
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

// Get All Invoice Logo
exports.getAllInvoiceLogo = async (req, res, next) => {
  try {
    const invoiceLogo = await InvoiceLogo.findAll()
    return res.status(200).json({
      message: 'Success',
      data:
        invoiceLogo?.length > 0
          ? invoiceLogo?.map((items) => {
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

// Post New Invoice Logo
exports.postNewInvoiceLogo = async (req, res, next) => {
  try {
    const { image, isActive, status, createdBy } = req.body
    const findOneInvoiceLogo = await InvoiceLogo?.findOne({
      where: {
        image: image
      }
    })

    if (!findOneInvoiceLogo?.getDataValue) {
      const postData = await InvoiceLogo.create({
        image: image,
        isActive: isActive,
        status: status,
        createdBy: createdBy
      })
      return res.status(200).json({
        status: 'success',
        data: postData
      })
    } else {
      return res.status(403).json({
        message: 'Invoice Logo Sudah Tersedia'
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

// Edit InvoiceLogo By Id
exports.editInvoiceLogoById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await InvoiceLogo.findOne({
      where: {
        image: body.image
      }
    })

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status
    ) {
      const editInvoiceLogo = await InvoiceLogo?.update(
        {
          image: body.image,
          status: body.status,
          createdBy: body.createdBy,
          modifiedBy: body?.modifiedBy,
          isActive: false
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
        message: 'Sukses Ubah Invoice Logo',
        data: editInvoiceLogo?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Invoice Logo Sudah Tersedia'
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

// Delete Invoice Logo By Id
exports.deleteInvoiceLogoById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await InvoiceLogo.destroy({
      where: {
        id: body.id,
        image: body.image
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Invoice Logo'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Invoice Logo Gagal'
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

// Activae / Not Activate Invoice By ID
exports.activateInvoiceLogoById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await InvoiceLogo.findOne({
      where: {
        image: body.image
      }
    })

    const getAllLogoNotById = await InvoiceLogo.findAll({
      where: {
        image: { [Op.notLike]: body.image }
      }
    }).then((items) => {
      console.log('ITEMS =>', items)
      return items.map((val) => val.id)
    })

    console.log('getAllLogoNotById =>', getAllLogoNotById)

    getAllLogoNotById.forEach(async (items) => {
      await InvoiceLogo.update(
        {
          isActive: false
        },
        {
          where: {
            id: items
          }
        }
      )
    })

    console.log('GET ALL LOGO NOT BY ID', getAllLogoNotById)

    if (getDuplicate?.dataValues) {
      const editInvoiceLogo = await InvoiceLogo?.update(
        {
          image: body.image,
          isActive: true
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
        message: 'Sukses Ubah Invoice Logo',
        data: editInvoiceLogo?.dataValues
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
