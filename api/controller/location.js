const db = require('../../db/models')
const Location = db.location
const sequelize = db.sequelize
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
const {
  uploadToCloudinary,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const {
  downloadLocationTemplate,
  parseLocationTemplate
} = require('../../utils/excelTemplate')

exports.getAllLocation = async (req, res) => {
  try {
    const userRole = req.user?.roleType
    const userStore = req.user?.store

    const whereCondition = { status: true }

    if (userRole === 'admin' || userRole === 'user') {
      whereCondition.id = userStore
    }

    const locations = await Location.findAll({ where: whereCondition })
    return res
      .status(200)
      .json({ success: true, message: 'Success', data: locations })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
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

    const [total, activeCount, citiesResult] = await Promise.all([
      Location.count({ where: whereClause }),
      Location.count({ where: { ...whereClause, status: true } }),
      Location.findAll({
        where: whereClause,
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('city')), 'city']],
        raw: true
      })
    ])
    const citiesCount = citiesResult.filter((r) => r.city).length

    const { rows: locations } = await Location.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']]
    })

    const data = locations.map((loc) => ({
      id: `loc-${String(loc.id).padStart(3, '0')}`,
      storeId: `ST-${String(loc.id).padStart(3, '0')}`,
      name: loc.name,
      address: loc.detailLocation,
      phoneNumber: loc.phoneNumber,
      email: loc.email,
      image: loc.image,
      isActive: loc.status,
      status: loc.status ? 'active' : 'inactive',
      city: loc.city,
      province: loc.province,
      district: loc.district,
      postalCode: loc.postalCode,
      category: loc.category || 'Main Branch',
      managerName: loc.managerName,
      openingHours: loc.openingHours || [
        { day: 'Monday', open: null, close: null },
        { day: 'Tuesday', open: null, close: null },
        { day: 'Wednesday', open: null, close: null },
        { day: 'Thursday', open: null, close: null },
        { day: 'Friday', open: null, close: null },
        { day: 'Saturday', open: null, close: null },
        { day: 'Sunday', open: null, close: null }
      ]
    }))

    return res.status(200).json({
      data,
      total,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        page: parseInt(page),
        limit: parseInt(limit)
      },
      stats: {
        total,
        active: activeCount,
        cities: citiesCount
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.generateLocationId = async (req, res) => {
  try {
    const lastLocation = await Location.findOne({
      order: [['id', 'DESC']],
      attributes: ['id']
    })

    const nextId = (lastLocation?.id || 0) + 1
    const locationId = `loc-${String(nextId).padStart(3, '0')}`

    return res.status(200).json({
      success: true,
      message: 'Location ID generated successfully',
      data: {
        locationId,
        storeId: `ST-${String(nextId).padStart(3, '0')}`
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' })
  }
}

exports.addNewLocation = async (req, res) => {
  const {
    name,
    phoneNumber,
    email,
    address,
    detailLocation,
    province,
    city,
    district,
    village,
    postalCode,
    description,
    isActive,
    category,
    managerName,
    latitude,
    longitude,
    mainBranch,
    openingHours,
    createdBy
  } = req.body
  const imageFile = req.file

  try {
    const existingLocation = await Location.findOne({ where: { name } })
    if (existingLocation) {
      return res
        .status(403)
        .json({ success: false, message: 'Location already exists' })
    }

    let imageUrl = null
    if (imageFile) {
      imageUrl = await uploadToCloudinary(
        imageFile.path,
        'pos-app-locations'
      )
    }

    const newLocation = await Location.create({
      image: imageUrl,
      name,
      phoneNumber,
      email,
      address,
      detailLocation,
      province,
      city,
      district,
      village,
      postalCode,
      description,
      status: isActive !== undefined ? isActive : true,
      category,
      managerName,
      latitude,
      longitude,
      mainBranch: mainBranch || false,
      openingHours: openingHours || [],
      createdBy
    })

    const locationId = `loc-${String(newLocation.id).padStart(3, '0')}`
    const storeId = `ST-${String(newLocation.id).padStart(3, '0')}`

    return res.status(200).json({
      success: true,
      message: 'Location created successfully',
      data: {
        id: newLocation.id,
        locationId,
        storeId,
        ...newLocation.dataValues
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' })
  }
}

exports.editLocationById = async (req, res) => {
  const { id, name, status, confirmUserUpdate, ...rest } = req.body
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID is required to update the location.'
    })
  }

  try {
    const location = await Location.findByPk(id)
    if (!location) {
      return res
        .status(404)
        .json({ success: false, message: 'Location not found.' })
    }

    const dataExist = location.dataValues
    let imageUrl = dataExist.image
    if (req.file) {
      if (dataExist.image) {
        await deleteFromCloudinary(dataExist.image)
      }
      imageUrl = await uploadToCloudinary(req.file.path, 'pos-app-locations')
    }

    const updatedData = { ...rest, image: imageUrl, name, status }

    if (compareObjects(dataExist, updatedData)) {
      return res
        .status(403)
        .json({ success: false, message: 'The location already exists.' })
    }

    if (name !== dataExist.name && confirmUserUpdate) {
      await User.update({ store: id }, { where: { store: id } })
    }

    const [_, updatedLocation] = await Location.update(updatedData, {
      returning: true,
      where: { id }
    })

    await batchUpdateModels(id, { status, name })

    return res.status(200).json({
      success: true,
      message: 'Successfully updated location.',
      data: updatedLocation.dataValues
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

exports.deleteLocationById = async (req, res) => {
  const { id } = req.body

  try {
    const location = await Location.findByPk(id)
    if (!location) {
      return res
        .status(404)
        .json({ success: false, message: 'Location not found' })
    }

    await Location.destroy({ where: { id }, force: true })
    return res
      .status(200)
      .json({ success: true, message: 'Location deleted successfully' })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' })
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
      attributes: [
        'id',
        'name',
        'image',
        'address',
        'detailLocation',
        'phoneNumber',
        'status'
      ]
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
    imageFiles.forEach((file) => {
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
        if (!location.name) {
          results.errors.push({
            no: location.no,
            message: 'Nama toko kosong'
          })
          continue
        }

        const statusValue = location.status.toLowerCase() === 'aktif'
        const locationFileName = location.name
          .toLowerCase()
          .replace(/\s+/g, '-')

        if (location.id) {
          const existingLocation = await Location.findOne({
            where: { id: location.id }
          })

          if (existingLocation) {
            const updateData = {
              name: location.name,
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
              imageUrl = await uploadToCloudinary(
                imageMap[locationFileName],
                'pos-app-locations'
              )
            } else if (
              location.image &&
              location.image !== existingLocation.image
            ) {
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
              name: location.name
            })
          } else {
            let imageUrl = location.image

            if (imageMap[locationFileName]) {
              imageUrl = await uploadToCloudinary(
                imageMap[locationFileName],
                'pos-app-locations'
              )
            }

            const newLocation = await Location.create({
              id: location.id,
              name: location.name,
              image: imageUrl || location.image,
              address: location.address,
              detailLocation: location.detailLocation,
              phoneNumber: location.phoneNumber,
              status: statusValue
            })
            results.created.push({
              id: newLocation.id,
              name: newLocation.name
            })
          }
        } else {
          const existingByName = await Location.findOne({
            where: { name: location.name }
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
              imageUrl = await uploadToCloudinary(
                imageMap[locationFileName],
                'pos-app-locations'
              )
            } else if (
              location.image &&
              location.image !== existingByName.image
            ) {
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
              name: location.name
            })
          } else {
            let imageUrl = location.image

            if (imageMap[locationFileName]) {
              imageUrl = await uploadToCloudinary(
                imageMap[locationFileName],
                'pos-app-locations'
              )
            }

            const newLocation = await Location.create({
              name: location.name,
              image: imageUrl || location.image,
              address: location.address,
              detailLocation: location.detailLocation,
              phoneNumber: location.phoneNumber,
              status: statusValue
            })
            results.created.push({
              id: newLocation.id,
              name: newLocation.name
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
