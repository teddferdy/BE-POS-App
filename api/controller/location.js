const db = require('../../db/models')
const Location = db.location
const User = db.user
const BestSelling = db.best_selling
const Checkout = db.checkout
const Product = db.product
const Category = db.category
const SubCategoryProduct = db.sub_category
const Discount = db.discount
const InvoiceFooter = db.invoice_footer
const InvoiceLogo = db.invoice_logo
const InvoiceSocialMedia = db.invoice_social_media
const Member = db.member
const SocialMedia = db.social_media
const TypePayment = db.type_payment
const Transaction = db.transaction
const Shift = db.shift

const { compareObjects } = require('../../utils/compare-value')
const { uploadToCloudinary, deleteFromCloudinary } = require('../../utils/cloudinaryStorage')
const { downloadLocationTemplate, parseLocationTemplate } = require('../../utils/excelTemplate')

exports.getAllLocation = async (req, res) => {
  try {
    const userRole = req.user?.roleType
    const userStore = req.user?.store

    const whereCondition = { status: true }

    if (userRole === 'admin' || userRole === 'user') {
      whereCondition.id = userStore
    }

    const locations = await Location.findAll({ where: whereCondition })
    return res.status(200).json({ success: true, message: 'Success', data: locations })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

exports.getAllLocationInTable = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query
    const offset = (page - 1) * limit

    let whereClause = {}
    if (status === 'true') {
      whereClause.status = true
    } else if (status === 'false') {
      whereClause.status = false
    }

    const { rows: locations, count } = await Location.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: locations,
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit)
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

exports.addNewLocation = async (req, res) => {
  const { nameStore, address, detailLocation, phoneNumber, status, createdBy } = req.body
  const imageFile = req.file

  try {
    const existingLocation = await Location.findOne({ where: { nameStore } })
    if (existingLocation) {
      return res.status(403).json({ success: false, message: 'Location already exists' })
    }

    const imageUrl = await uploadToCloudinary(imageFile.path, 'pos-app-locations')

    await Location.create({
      image: imageUrl,
      nameStore,
      imageName: imageFile.originalname,
      address,
      detailLocation,
      phoneNumber,
      status,
      createdBy
    })

    return res.status(200).json({ success: true, message: 'Location created successfully' })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

exports.editLocationById = async (req, res) => {
  const { id, nameStore, status, confirmUserUpdate, ...rest } = req.body
  if (!id) {
    return res.status(400).json({ success: false, message: 'ID is required to update the location.' })
  }

  try {
    const location = await Location.findByPk(id)
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found.' })
    }

    const dataExist = location.dataValues
    let imageUrl = dataExist.image
    if (req.file) {
      if (dataExist.image) {
        await deleteFromCloudinary(dataExist.image)
      }
      imageUrl = await uploadToCloudinary(req.file.path, 'pos-app-locations')
    }

    const updatedData = { ...rest, image: imageUrl, nameStore, status }

    if (compareObjects(dataExist, updatedData)) {
      return res.status(403).json({ success: false, message: 'The location already exists.' })
    }

    if (nameStore !== dataExist.nameStore && confirmUserUpdate) {
      await User.update({ store: id }, { where: { store: id } })
    }

    const [_, updatedLocation] = await Location.update(updatedData, {
      returning: true,
      where: { id }
    })

    await batchUpdateModels(id, { status, nameStore })

    return res.status(200).json({
      success: true,
      message: 'Successfully updated location.',
      data: updatedLocation.dataValues
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

exports.deleteLocationById = async (req, res) => {
  const { id } = req.body

  try {
    const location = await Location.findByPk(id)
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' })
    }

    await Location.destroy({ where: { id }, force: true })
    return res.status(200).json({ success: true, message: 'Location deleted successfully' })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

const batchUpdateModels = async (id, updateFields) => {
  const modelsToUpdate = [
    User,
    Product,
    Transaction,
    BestSelling,
    Checkout,
    Category,
    SubCategoryProduct,
    Discount,
    InvoiceFooter,
    InvoiceLogo,
    InvoiceSocialMedia,
    Member,
    SocialMedia,
    TypePayment,
    Shift
  ]

  for (const model of modelsToUpdate) {
    await model.update(updateFields, { where: { store: id } })
  }
}

exports.downloadTemplate = async (req, res) => {
  try {
    const existingLocations = await Location.findAll({
      attributes: ['id', 'nameStore', 'image', 'address', 'detailLocation', 'phoneNumber', 'status']
    })

    const buffer = await downloadLocationTemplate(existingLocations)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=template_lokasi.xlsx'
    )

    res.send(buffer)
  } catch (err) {
    console.error('Error downloading template:', err)
    res.status(500).json({
      success: false,
      message: 'Gagal mengunduh template',
      error: err.message
    })
  }
}

exports.importLocation = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'File Excel diperlukan'
    })
  }

  try {
    const locations = await parseLocationTemplate(req.file.buffer)

    if (!locations.length) {
      return res.status(400).json({
        success: false,
        message: 'Data lokasi tidak ditemukan di file Excel'
      })
    }

    const imageFiles = req.files || []
    const imageMap = {}
    imageFiles.forEach(file => {
      const baseName = file.originalname.replace(/\.[^/.]+$/, '').toLowerCase()
      imageMap[baseName] = file.path
    })

    const results = {
      created: [],
      updated: [],
      errors: []
    }

    for (const location of locations) {
      try {
        if (!location.nameStore) {
          results.errors.push({
            no: location.no,
            message: 'Nama toko kosong'
          })
          continue
        }

        const statusValue = location.status.toLowerCase() === 'aktif'
        const locationFileName = location.nameStore.toLowerCase().replace(/\s+/g, '-')

        if (location.id) {
          const existingLocation = await Location.findOne({
            where: { id: location.id }
          })

          if (existingLocation) {
            const updateData = {
              nameStore: location.nameStore,
              address: location.address,
              detailLocation: location.detailLocation,
              phoneNumber: location.phoneNumber,
              status: statusValue
            }

            let imageUrl = location.image

            if (imageMap[locationFileName]) {
              if (existingLocation.image) {
                await deleteFromCloudinary(existingLocation.image)
              }
              imageUrl = await uploadToCloudinary(imageMap[locationFileName], 'pos-app-locations')
            } else if (location.image && location.image !== existingLocation.image) {
              if (existingLocation.image) {
                await deleteFromCloudinary(existingLocation.image)
              }
              imageUrl = location.image
            } else if (!location.image) {
              imageUrl = existingLocation.image
            }

            if (imageUrl) {
              updateData.image = imageUrl
            }

            await existingLocation.update(updateData)
            results.updated.push({
              id: location.id,
              nameStore: location.nameStore
            })
          } else {
            let imageUrl = location.image

            if (imageMap[locationFileName]) {
              imageUrl = await uploadToCloudinary(imageMap[locationFileName], 'pos-app-locations')
            }

            const newLocation = await Location.create({
              id: location.id,
              nameStore: location.nameStore,
              image: imageUrl || location.image,
              address: location.address,
              detailLocation: location.detailLocation,
              phoneNumber: location.phoneNumber,
              status: statusValue
            })
            results.created.push({
              id: newLocation.id,
              nameStore: newLocation.nameStore
            })
          }
        } else {
          const existingByName = await Location.findOne({
            where: { nameStore: location.nameStore }
          })

          if (existingByName) {
            const updateData = {
              address: location.address,
              detailLocation: location.detailLocation,
              phoneNumber: location.phoneNumber,
              status: statusValue
            }

            let imageUrl = location.image

            if (imageMap[locationFileName]) {
              if (existingByName.image) {
                await deleteFromCloudinary(existingByName.image)
              }
              imageUrl = await uploadToCloudinary(imageMap[locationFileName], 'pos-app-locations')
            } else if (location.image && location.image !== existingByName.image) {
              if (existingByName.image) {
                await deleteFromCloudinary(existingByName.image)
              }
              imageUrl = location.image
            } else if (!location.image) {
              imageUrl = existingByName.image
            }

            if (imageUrl) {
              updateData.image = imageUrl
            }

            await existingByName.update(updateData)
            results.updated.push({
              id: existingByName.id,
              nameStore: location.nameStore
            })
          } else {
            let imageUrl = location.image

            if (imageMap[locationFileName]) {
              imageUrl = await uploadToCloudinary(imageMap[locationFileName], 'pos-app-locations')
            }

            const newLocation = await Location.create({
              nameStore: location.nameStore,
              image: imageUrl || location.image,
              address: location.address,
              detailLocation: location.detailLocation,
              phoneNumber: location.phoneNumber,
              status: statusValue
            })
            results.created.push({
              id: newLocation.id,
              nameStore: newLocation.nameStore
            })
          }
        }
      } catch (err) {
        results.errors.push({
          no: location.no,
          message: err.message
        })
      }
    }

    res.status(200).json({
      success: true,
      message: `Berhasil import ${results.created.length} lokasi baru dan ${results.updated.length} lokasi diupdate`,
      data: results
    })
  } catch (err) {
    console.error('Error importing locations:', err)
    res.status(500).json({
      success: false,
      message: 'Gagal mengimport lokasi',
      error: err.message
    })
  }
}