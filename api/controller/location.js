const { Op } = require('sequelize')
const db = require('../../db/models')
const Location = db.location
const sequelize = db.sequelize
const User = db.user
const BestSelling = db.best_selling
const Checkout = db.checkout
const Category = db.category
const Discount = db.discount
const InvoiceFooter = db.invoice_footer
const InvoiceLogo = db.invoice_logo
const InvoiceSocialMedia = db.invoice_social_media
const Member = db.member
const SocialMedia = db.social_media
const TypePayment = db.type_payment
const Shift = db.shift
const Ingredient = db.ingredient
const CashRegister = db.cash_register
const DailySummary = db.daily_summary
const StockOpname = db.stockOpname
const StockHistory = db.stock_history
const PurchaseOrder = db.purchase_order
const Order = db.order
const Expense = db.expense
const Table = db.table
const MemberTier = db.member_tier
const Supplier = db.supplier
const ExpenseCategory = db.expense_category
const Position = db.position
const Role = db.role

const {
  uploadToCloudinary,
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createNotification } = require('../../utils/createNotification')
const {
  downloadLocationTemplate,
  parseLocationTemplate
} = require('../../utils/excelTemplate')

exports.getAllLocation = async (req, res) => {
  try {
    const userRole = req.user?.roleType
    const userStore = req.user?.store

    let whereCondition = {}
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
        inactive: total - activeCount
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    })
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
  let bodyData = req.body
  if (req.body.data) {
    try {
      bodyData =
        typeof req.body.data === 'string'
          ? JSON.parse(req.body.data)
          : req.body.data
    } catch {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid JSON format in data field' })
    }
  }
  const {
    locationId,
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
    coordinates,
    mainBranch,
    openingHours,
    createdBy
  } = bodyData

  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required' })
  }

  const imageFile = req.file
  if (!imageFile) {
    return res
      .status(400)
      .json({ success: false, message: 'Image is required' })
  }

  // Handle coordinates mapping
  const finalLatitude = coordinates?.lat ?? latitude ?? null
  const finalLongitude = coordinates?.lng ?? longitude ?? null

  try {
    // If locationId is provided, use it; otherwise generate new ID
    let nextId
    if (locationId) {
      nextId = parseInt(locationId.replace('loc-', ''))

      // Check if location with this ID already exists
      const existingLocation = await Location.findOne({ where: { id: nextId } })
      if (existingLocation) {
        return res
          .status(403)
          .json({ success: false, message: 'Location ID already exists' })
      }
    } else {
      // Generate new ID based on current max
      const lastLocation = await Location.findOne({
        order: [['id', 'DESC']],
        attributes: ['id']
      })
      nextId = (lastLocation?.id || 0) + 1
    }

    // Check for duplicate name
    const existingLocationByName = await Location.findOne({ where: { name } })
    if (existingLocationByName) {
      return res
        .status(403)
        .json({ success: false, message: 'Location already exists' })
    }

    let imageUrl = null
    if (imageFile) {
      const { url, hash } = await uploadToCloudinaryWithDedup(
        imageFile.path,
        'pos-app-locations'
      )
      const duplicate = await Location.findOne({
        where: { image: url, id: { [Op.ne]: nextId } }
      })
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Gambar sudah digunakan oleh lokasi lain'
        })
      }
      imageUrl = url
    }

    const newLocation = await Location.create({
      id: nextId,
      store: nextId,
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
      latitude: finalLatitude,
      longitude: finalLongitude,
      mainBranch: mainBranch || false,
      openingHours: openingHours || [],
      createdBy
    })

    const newLocationId = `loc-${String(newLocation.id).padStart(3, '0')}`
    const storeId = `ST-${String(newLocation.id).padStart(3, '0')}`

    createNotification({ type: 'location_created', store: newLocation.store, referenceId: newLocation.id, referenceType: 'location', params: [name] }).catch(console.error)

    return res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: {
        id: newLocation.id,
        locationId: newLocationId,
        storeId,
        ...newLocation.dataValues
      }
    })
  } catch (error) {
    console.error('Error:', error)
    const message = error.http_code
      ? `Gagal upload gambar: ${error.message}`
      : error.message || 'Internal server error'
    return res.status(500).json({ success: false, message })
  }
}

exports.editLocationById = async (req, res) => {
  let bodyData = req.body
  if (req.body.data) {
    try {
      bodyData =
        typeof req.body.data === 'string'
          ? JSON.parse(req.body.data)
          : req.body.data
    } catch {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid JSON format in data field' })
    }
  }
  const {
    locationId: rawId,
    id: rawIdAlt,
    name,
    status,
    confirmUserUpdate,
    coordinates,
    image,
    storeId,
    location: locationField,
    isActive,
    ...rest
  } = bodyData
  const id = rawId
    ? parseInt(rawId.replace('loc-', ''))
    : rawIdAlt
      ? parseInt(String(rawIdAlt).replace('loc-', ''))
      : null
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
      const { url, hash } = await uploadToCloudinaryWithDedup(
        req.file.path,
        'pos-app-locations'
      )
      const duplicate = await Location.findOne({
        where: { image: url, id: { [Op.ne]: id } }
      })
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Gambar sudah digunakan oleh lokasi lain'
        })
      }
      if (dataExist.image && dataExist.image !== url) {
        await deleteFromCloudinary(dataExist.image)
      }
      imageUrl = url
    }

    const updatedData = { ...rest, image: imageUrl, name, status }

    // Handle coordinates mapping
    if (coordinates) {
      if (coordinates.lat) updatedData.latitude = coordinates.lat
      if (coordinates.lng) updatedData.longitude = coordinates.lng
    }

    // Map isActive to status
    if (isActive !== undefined) {
      updatedData.status = isActive
    }

    const [affectedCount, updatedRows] = await Location.update(updatedData, {
      returning: true,
      where: { id }
    })

    // Only propagate status changes to related models (not name)
    await batchUpdateModels(id, { status: updatedData.status })

    createNotification({ type: 'location_updated', store: id, referenceId: id, referenceType: 'location', params: [name] }).catch(console.error)

    return res.status(200).json({
      success: true,
      message: 'Successfully updated location.',
      data: updatedRows[0]?.dataValues || null
    })
  } catch (error) {
    console.error('Error:', error)
    const message = error.http_code
      ? `Gagal upload gambar: ${error.message}`
      : error.message || 'Internal server error'
    return res.status(500).json({ success: false, message })
  }
}

// Map model -> update payload when location is deleted
// Different models need different status handling based on their field types
const getLocationDeleteUpdates = () => [
  // Boolean status -> set status = false
  { model: Discount,       update: { store: null, status: false } },
  { model: InvoiceFooter,  update: { store: null, status: false } },
  { model: InvoiceLogo,    update: { store: null, status: false } },
  { model: InvoiceSocialMedia, update: { store: null, status: false } },
  { model: Member,         update: { store: null, status: false } },
  { model: SocialMedia,    update: { store: null, status: false } },
  { model: TypePayment,    update: { store: null, status: false } },
  { model: Shift,          update: { store: null, status: false } },
  { model: Ingredient,     update: { store: null, status: false } },
  { model: MemberTier,     update: { store: null, status: false } },
  { model: Supplier,       update: { store: null, status: false } },
  { model: ExpenseCategory, update: { store: null, status: false } },
  { model: Position,       update: { store: null, status: false } },
  { model: Role,           update: { store: null, status: false } },

  // ENUM status models -> set appropriate closed/cancelled state
  { model: StockOpname,    update: { store: null, status: 'cancelled' } },
  { model: Order,          update: { store: null, status: 'cancelled' } },
  { model: PurchaseOrder,  update: { store: null, status: 'cancelled' } },
  { model: CashRegister,   update: { store: null, status: 'closed' } },
  { model: Expense,        update: { store: null, status: 'rejected' } },
  { model: Table,          update: { store: null, status: 'maintenance' } },

  // No status field -> just null the store reference
  { model: DailySummary,   update: { store: null } },
  { model: StockHistory,   update: { store: null } },

  // Models without status field
  { model: Checkout,       update: { store: null } },
  { model: BestSelling,    update: { store: null } },

  // Special: User -> also deactivate account
  { model: User,           update: { store: null, statusActive: false } },
]

exports.deleteLocationById = async (req, res) => {
  const { id } = req.body

  try {
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID is required' })
    }
    const dbId = parseInt(id.replace('loc-', ''))

    const location = await Location.findByPk(dbId)
    if (!location) {
      return res
        .status(404)
        .json({ success: false, message: 'Location not found' })
    }

    const entries = getLocationDeleteUpdates()

    for (const { model, update } of entries) {
      try {
        await model.update(update, { where: { store: dbId } })
      } catch (modelError) {
        console.error(`Error updating ${model.name || 'unknown'}:`, modelError.message)
      }
    }

    // Delete location image if exists
    if (location.image) {
      await deleteFromCloudinary(location.image)
    }

    // Hard delete the location (force: true bypasses paranoid if set)
    await Location.destroy({ where: { id: dbId }, force: true })

    createNotification({ type: 'location_deleted', store: dbId, referenceId: dbId, referenceType: 'location', params: [location.name] }).catch(console.error)

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
    User, BestSelling, Checkout,
    Category, Discount,
    InvoiceFooter, InvoiceLogo, InvoiceSocialMedia,
    Member, SocialMedia, TypePayment, Shift,
    Ingredient, CashRegister, DailySummary, StockOpname, StockHistory,
    PurchaseOrder, Order, Expense, Table,
    MemberTier, Supplier, ExpenseCategory, Position, Role
  ]

  for (const model of modelsToUpdate) {
    try {
      await model.update(updateFields, { where: { store: id } })
    } catch (modelError) {
      console.error(`Error batch updating ${model.name || 'unknown'}:`, modelError.message)
    }
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

exports.getLocationById = async (req, res) => {
  const { locationId } = req.params

  try {
    if (!locationId) {
      return res.status(400).json({ success: false, message: 'Location ID is required' })
    }
    const dbId = parseInt(locationId.replace('loc-', ''))

    const location = await Location.findByPk(dbId)
    if (!location) {
      return res
        .status(404)
        .json({ success: false, message: 'Location not found' })
    }

    const data = {
      id: `loc-${String(location.id).padStart(3, '0')}`,
      storeId: `ST-${String(location.id).padStart(3, '0')}`,
      name: location.name,
      address: location.address,
      detailLocation: location.detailLocation,
      phoneNumber: location.phoneNumber,
      email: location.email,
      image: location.image,
      isActive: location.status,
      status: location.status ? 'active' : 'inactive',
      city: location.city,
      province: location.province,
      district: location.district,
      village: location.village,
      postalCode: location.postalCode,
      category: location.category || 'Main Branch',
      managerName: location.managerName,
      latitude: location.latitude,
      longitude: location.longitude,
      mainBranch: location.mainBranch,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      openingHours: location.openingHours || [
        { day: 'Monday', open: null, close: null },
        { day: 'Tuesday', open: null, close: null },
        { day: 'Wednesday', open: null, close: null },
        { day: 'Thursday', open: null, close: null },
        { day: 'Friday', open: null, close: null },
        { day: 'Saturday', open: null, close: null },
        { day: 'Sunday', open: null, close: null }
      ]
    }

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res.status(200).json({ success: true, message: 'Success', data })
  } catch (error) {
    console.error('Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
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
    if (!req.files || !req.files['file'] || !req.files['file'][0]) {
      return res.status(400).json({
        success: false,
        message: 'File Excel diperlukan'
      })
    }

    const locations = await parseLocationTemplate(req.files['file'][0].buffer)

    if (!locations.length) {
      return res.status(400).json({
        success: false,
        message: 'Data lokasi tidak ditemukan di file Excel'
      })
    }

    const imageFiles = req.files['images'] || []
    const imageMap = {}
    const { writeFileSync, unlinkSync } = require('fs')
    const { join } = require('path')
    const tmpDir = '/tmp/location-import-images'
    if (!require('fs').existsSync(tmpDir)) {
      require('fs').mkdirSync(tmpDir, { recursive: true })
    }

    for (const file of imageFiles) {
      const baseName = file.originalname.replace(/\.[^/.]+$/, '').toLowerCase()
      const tmpPath = join(tmpDir, `${Date.now()}-${file.originalname}`)
      writeFileSync(tmpPath, file.buffer)
      imageMap[baseName] = tmpPath
    }

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
              status: statusValue,
              createdBy: req.user?.userName || req.user?.id || 'system'
            })
            if (newLocation) {
              await newLocation.update({ store: newLocation.id })
            }
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
              status: statusValue,
              createdBy: req.user?.userName || req.user?.id || 'system'
            })
            if (newLocation) {
              await newLocation.update({ store: newLocation.id })
            }
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

    Object.values(imageMap).forEach((p) => {
      try { require('fs').unlinkSync(p) } catch {}
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
