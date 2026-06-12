const { Op } = require('sequelize')
const db = require('../../db/models')
const Location = db.location
const sequelize = db.sequelize
const User = db.user
const BestSelling = db.best_selling
const Checkout = db.checkout
const Category = db.category
const Discount = db.discount
const InvoiceSetting = db.invoice_setting
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
const { createAudit } = require('../../utils/auditLog')
const {
  downloadLocationTemplate,
  parseLocationTemplate
} = require('../../utils/excelTemplate')

exports.getAllLocationPublic = async (req, res) => {
  try {
    const locations = await Location.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'city', 'province', 'detailLocation']
    })
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
    const { page = 1, limit = 10, status = 'all', category = 'all' } = req.query
    const offset = (page - 1) * limit

    let whereClause = {}
    if (status === 'active' || status === 'true') {
      whereClause.status = 'active'
    } else if (status === 'inactive' || status === 'false') {
      whereClause.status = 'inactive'
    }
    if (category !== 'all') {
      whereClause.category = category
    }

    const [total, activeCount, inactiveCount, citiesResult] = await Promise.all(
      [
        Location.count({ where: whereClause }),
        Location.count({ where: { status: 'active' } }),
        Location.count({ where: { status: 'inactive' } }),
        Location.findAll({
          where: whereClause,
          attributes: [
            [sequelize.fn('DISTINCT', sequelize.col('city')), 'city']
          ],
          raw: true
        })
      ]
    )
    const citiesCount = citiesResult.filter((r) => r.city).length

    const categoriesResult = await Location.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('category')), 'category']
      ],
      raw: true
    })
    const categories = categoriesResult
      .map((r) => r.category)
      .filter(Boolean)
      .sort()

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
      isActive: loc.status === 'active',
      status: loc.status,
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
      ],
      socialMedia: loc.socialMedia || []
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
        total: activeCount + inactiveCount,
        active: activeCount,
        inactive: inactiveCount,
        cities: citiesCount
      },
      categories
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
    socialMedia,
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
      status:
        isActive !== undefined ? (isActive ? 'active' : 'inactive') : 'active',
      category,
      managerName,
      latitude: finalLatitude,
      longitude: finalLongitude,
      mainBranch: mainBranch || false,
      openingHours: openingHours || [],
      socialMedia: socialMedia || [],
      createdBy
    })

    const newLocationId = `loc-${String(newLocation.id).padStart(3, '0')}`
    const storeId = `ST-${String(newLocation.id).padStart(3, '0')}`

    createNotification({
      type: 'location_created',
      store: newLocation.store,
      referenceId: newLocation.id,
      referenceType: 'location',
      params: [name]
    }).catch(console.error)
    createAudit(
      req,
      'create',
      'location',
      newLocation.id,
      `Created location: ${name}`
    )

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

    const updatedData = {
      ...rest,
      image: imageUrl,
      name,
      status:
        status !== undefined
          ? status === true
            ? 'active'
            : status === false
              ? 'inactive'
              : status
          : undefined
    }

    // Handle coordinates mapping
    if (coordinates) {
      if (coordinates.lat) updatedData.latitude = coordinates.lat
      if (coordinates.lng) updatedData.longitude = coordinates.lng
    }

    // Map isActive to status
    if (isActive !== undefined) {
      updatedData.status = isActive ? 'active' : 'inactive'
    }

    const [affectedCount, updatedRows] = await Location.update(updatedData, {
      returning: true,
      where: { id }
    })

    // Only propagate status changes to related models (not name)
    await batchUpdateModels(id, { status: updatedData.status })

    createNotification({
      type: 'location_updated',
      store: id,
      referenceId: id,
      referenceType: 'location',
      params: [name]
    }).catch(console.error)
    createAudit(
      req,
      'update',
      'location',
      id,
      `Updated location: ${name}`,
      dataExist,
      updatedData
    )

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
  { model: Discount, update: { store: null, status: 'inactive' } },
  { model: InvoiceSetting, update: { store: null, status: 'inactive' } },
  { model: Member, update: { store: null, status: 'inactive' } },
  { model: SocialMedia, update: { store: null, status: 'inactive' } },
  { model: TypePayment, update: { store: null, status: 'inactive' } },
  { model: Shift, update: { store: null, status: 'inactive' } },
  { model: Ingredient, update: { store: null, status: 'inactive' } },
  { model: MemberTier, update: { store: null, status: 'inactive' } },
  { model: Supplier, update: { store: null, status: 'inactive' } },
  { model: ExpenseCategory, update: { store: null, status: 'inactive' } },
  { model: Position, update: { store: null, status: 'inactive' } },
  { model: Role, update: { store: null, status: 'inactive' } },

  // ENUM status models -> set appropriate closed/cancelled state
  { model: StockOpname, update: { store: null, status: 'cancelled' } },
  { model: Order, update: { store: null, status: 'cancelled' } },
  { model: PurchaseOrder, update: { store: null, status: 'cancelled' } },
  { model: CashRegister, update: { store: null, status: 'closed' } },
  { model: Expense, update: { store: null, status: 'rejected' } },
  { model: Table, update: { store: null, status: 'maintenance' } },

  // No status field -> just null the store reference
  { model: DailySummary, update: { store: null } },
  { model: StockHistory, update: { store: null } },

  // Models without status field
  { model: Checkout, update: { store: null } },
  { model: BestSelling, update: { store: null } },

  // Special: User -> also deactivate account
  { model: User, update: { store: null, statusActive: false } }
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
        console.error(
          `Error updating ${model.name || 'unknown'}:`,
          modelError.message
        )
      }
    }

    // Delete location image if exists
    if (location.image) {
      await deleteFromCloudinary(location.image)
    }

    // Hard delete the location (force: true bypasses paranoid if set)
    await Location.destroy({ where: { id: dbId } })

    createNotification({
      type: 'location_deleted',
      store: dbId,
      referenceId: dbId,
      referenceType: 'location',
      params: [location.name]
    }).catch(console.error)
    createAudit(
      req,
      'delete',
      'location',
      dbId,
      `Deleted location: ${location.name}`
    )

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
    BestSelling,
    Checkout,
    Category,
    Discount,
    InvoiceSetting,
    Member,
    SocialMedia,
    TypePayment,
    Shift,
    Ingredient,
    CashRegister,
    DailySummary,
    StockOpname,
    StockHistory,
    PurchaseOrder,
    Order,
    Expense,
    Table,
    MemberTier,
    Supplier,
    ExpenseCategory,
    Position,
    Role
  ]

  for (const model of modelsToUpdate) {
    try {
      await model.update(updateFields, { where: { store: id } })
    } catch (modelError) {
      console.error(
        `Error batch updating ${model.name || 'unknown'}:`,
        modelError.message
      )
    }
  }
}

exports.getLocationById = async (req, res) => {
  const { locationId } = req.params

  try {
    if (!locationId) {
      return res
        .status(400)
        .json({ success: false, message: 'Location ID is required' })
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
      status: location.status === 'active' ? 'active' : 'inactive',
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
      ],
      socialMedia: location.socialMedia || []
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
