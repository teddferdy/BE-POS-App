/* eslint-disable no-unsafe-finally */
/* eslint-disable no-unused-vars */
const InvoiceSocialMedia = require('../../db/models/invoice_social_media')
const { Op } = require('sequelize')

// Get Logo Using To Invoice
exports.getInvoiceSocialMediaByIsActive = async (req, res, next) => {
  try {
    const invoiceSocialMedia = await InvoiceSocialMedia.findAll({
      where: {
        isActive: true
      }
    })
    return res.status(200).json({
      message: 'Success',
      data:
        invoiceSocialMedia?.length > 0
          ? invoiceSocialMedia?.map((items) => {
              return {
                ...items?.dataValues,
                socialMediaList: JSON?.parse(items?.dataValues?.socialMediaList)
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

// Get All Social Media Invoice
exports.getAllInvoiceSocialMedia = async (req, res, next) => {
  try {
    const invoiceSocialMedia = await InvoiceSocialMedia.findAll()
    return res.status(200).json({
      message: 'Success',
      data:
        invoiceSocialMedia?.length > 0
          ? invoiceSocialMedia?.map((items) => {
              return {
                ...items?.dataValues,
                socialMediaList: JSON?.parse(items?.dataValues?.socialMediaList)
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

// Post New Social Media Invoice
exports.postNewInvoiceSocialMedia = async (req, res, next) => {
  try {
    const { name, socialMediaList, isActive, status, createdBy } = req.body
    const findOneInvoiceSocialMedia = await InvoiceSocialMedia?.findOne({
      where: {
        name: name
      }
    })

    if (!findOneInvoiceSocialMedia?.getDataValue) {
      const postData = await InvoiceSocialMedia.create({
        name: name,
        socialMediaList: socialMediaList,
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
        message: 'Template Name Invoice Social Media Sudah Tersedia'
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

// Edit InvoiceSocialMedia By Id
exports.editInvoiceSocialMediaById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await InvoiceSocialMedia.findOne({
      where: {
        name: body.name
      }
    })

    const bodySocialMediaList = JSON.parse(body.socialMediaList)
    const duplicateSocialMediaList = JSON.parse(
      getDuplicate.dataValues.socialMediaList
    )

    if (
      !getDuplicate?.dataValues ||
      !getDuplicate?.dataValues?.status === body?.status ||
      bodySocialMediaList.length !== duplicateSocialMediaList.length
    ) {
      const editInvoiceSocialMedia = await InvoiceSocialMedia?.update(
        {
          name: body.name,
          socialMediaList: body.socialMediaList,
          createdBy: body.createdBy,
          modifiedBy: body?.modifiedBy,
          status: body.status,
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
        message: 'Sukses Ubah Invoice Social Media',
        data: editInvoiceSocialMedia?.dataValues
      })
    } else {
      return res.status(403).json({
        message: 'Invoice Social Media Sudah Tersedia'
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

// Delete Social Media Invoice By Id
exports.deleteInvoiceSocialMediaById = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await InvoiceSocialMedia.destroy({
      where: {
        id: body.id,
        name: body.name
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Social Media Invoice'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Social Media Invoice Gagal'
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
exports.activateInvoiceSocialMediaById = async (req, res, next) => {
  const body = req.body
  try {
    const getDuplicate = await InvoiceSocialMedia.findOne({
      where: {
        name: body.name
      }
    })

    const getAllLogoNotById = await InvoiceSocialMedia.findAll({
      where: {
        name: { [Op.notLike]: body.name }
      }
    }).then((items) => {
      return items.map((val) => val.id)
    })

    getAllLogoNotById.forEach(async (items) => {
      await InvoiceSocialMedia.update(
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

    if (getDuplicate?.dataValues) {
      const editInvoiceSocialMedia = await InvoiceSocialMedia?.update(
        {
          name: body.name,
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
        message: 'Sukses Ubah Social Media Invoice',
        data: editInvoiceSocialMedia?.dataValues
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
