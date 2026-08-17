const { Op } = require('sequelize')
const db = require('../../db/models')
const Location = db.location
const Region = db.region
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
const CashRegister = db.cashRegister
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
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

exports.getAllLocationPublic = async (req, res) => {
  try {
    const { status } = req.query
    const whereClause = status === 'all' ? {} : { status: 'active' }
    const locations = await Location.findAll({
      where: whereClause,
      attributes: [
        'id',
        'store',
        'name',
        'city',
        'province',
        'detailLocation',
        'latitude',
        'longitude',
        'status'
      ]
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
    const userRole = req.user?.roleType
    const {
      page = 1,
      limit = 10,
      status = 'all',
      category = 'all',
      search,
      store: queryStore
    } = req.query
    const offset = (page - 1) * limit

    let whereClause = {}
    if (status === 'active' || status === 'true') {
      whereClause.status = 'active'
    } else if (status === 'inactive' || status === 'false') {
      whereClause.status = 'inactive'
    } else if (status === 'draft') {
      whereClause.status = 'draft'
    }

    if (userRole === 'super_admin' && queryStore) {
      whereClause.id = queryStore
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { detailLocation: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } }
      ]
    }

    if (category && category !== 'all') {
      whereClause.category = category
    }

    const [total, activeCount, inactiveCount, draftCount, citiesResult] =
      await Promise.all([
        Location.count({ where: whereClause }),
        Location.count({ where: { status: 'active' } }),
        Location.count({ where: { status: 'inactive' } }),
        Location.count({ where: { status: 'draft' } }),
        Location.findAll({
          where: whereClause,
          attributes: [
            [sequelize.fn('DISTINCT', sequelize.col('city')), 'city']
          ],
          raw: true
        })
      ])
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
      order: [['createdAt', 'DESC']]
    })

    await enrichAuditFields(db, locations)

    // Resolve region codes (province/city/district/village) to their names
    const regionCodes = []
    for (const loc of locations) {
      if (loc.province) regionCodes.push(['province', loc.province])
      if (loc.city) regionCodes.push(['city', loc.city])
      if (loc.district) regionCodes.push(['district', loc.district])
      if (loc.village) regionCodes.push(['village', loc.village])
    }
    const regionNameMap = {}
    if (regionCodes.length) {
      try {
        const regions = await Region.findAll({
          where: {
            [Op.or]: regionCodes.map(([level, code]) => ({ level, code }))
          },
          attributes: ['level', 'code', 'name'],
          raw: true
        })
        for (const r of regions) {
          regionNameMap[`${r.level}:${r.code}`] = r.name
        }
      } catch (_) {
        // region table may not exist yet — fall back to raw codes
      }
    }
    const nameFor = (level, code) =>
      code ? regionNameMap[`${level}:${code}`] || code : null

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
      province: loc.province,
      provinceName: nameFor('province', loc.province),
      city: loc.city,
      cityName: nameFor('city', loc.city),
      district: loc.district,
      districtName: nameFor('district', loc.district),
      village: loc.village,
      villageName: nameFor('village', loc.village),
      postalCode: loc.postalCode,
      category: loc.category || 'Main Branch',
      managerName: loc.managerName,
      dailyTarget: loc.dailyTarget,
      latitude: loc.latitude,
      longitude: loc.longitude,
      openingHours: loc.openingHours || [
        { day: 'Monday', open: null, close: null },
        { day: 'Tuesday', open: null, close: null },
        { day: 'Wednesday', open: null, close: null },
        { day: 'Thursday', open: null, close: null },
        { day: 'Friday', open: null, close: null },
        { day: 'Saturday', open: null, close: null },
        { day: 'Sunday', open: null, close: null }
      ],
      socialMedia: loc.socialMedia || [],
      createdAt: loc.createdAt,
      updatedAt: loc.updatedAt,
      createdBy: loc.createdBy,
      createdByUser: loc.dataValues?.createdByUser || null,
      modifiedBy: loc.modifiedBy,
      modifiedByUser: loc.dataValues?.modifiedByUser || null
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
        total: activeCount + inactiveCount + draftCount,
        active: activeCount,
        inactive: inactiveCount,
        draft: draftCount,
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
      order: [['createdAt', 'DESC']],
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
    status,
    category,
    managerName,
    latitude,
    longitude,
    coordinates,
    mainBranch,
    openingHours,
    socialMedia,
    _createdBy
  } = bodyData

  const imageFile = req.file

  // Handle coordinates mapping
  const finalLatitude = coordinates?.lat ?? latitude ?? null
  const finalLongitude = coordinates?.lng ?? longitude ?? null

  try {
    // If locationId is provided, use it; otherwise generate new ID
    let nextId
    let idConflict = false
    if (locationId) {
      nextId = parseInt(locationId.replace('loc-', ''))

      // Check if location with this ID already exists (include soft-deleted)
      const existingLocation = await Location.findOne({
        where: { id: nextId },
        paranoid: false,
        attributes: ['id', 'deletedAt']
      })
      if (existingLocation) {
        if (!existingLocation.deletedAt) {
          return res
            .status(403)
            .json({ success: false, message: 'Location ID already exists' })
        }
        // Soft-deleted — can't force-delete due to FK constraints, so fall back
        idConflict = true
      }
    }
    if (!locationId || idConflict) {
      // Generate new ID based on max id (include soft-deleted)
      const maxId = await Location.max('id', { paranoid: false })
      nextId = (maxId || 0) + 1
    }

    // Check for duplicate name
    if (name) {
      const existingLocationByName = await Location.findOne({ where: { name } })
      if (existingLocationByName) {
        return res
          .status(403)
          .json({ success: false, message: 'Location already exists' })
      }
    }

    let imageUrl = null
    if (imageFile) {
      const { url } = await uploadToCloudinaryWithDedup(
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
        status ||
        (isActive !== undefined ? (isActive ? 'active' : 'inactive') : 'draft'),
      category,
      managerName,
      latitude: finalLatitude,
      longitude: finalLongitude,
      mainBranch: mainBranch || false,
      openingHours: openingHours || [],
      socialMedia: socialMedia || [],
      createdBy: req.user?.id || null
    })

    const newLocationId = `loc-${String(newLocation.id).padStart(3, '0')}`
    const storeId = `ST-${String(newLocation.id).padStart(3, '0')}`

    createNotification({
      type: 'location_created',
      store: newLocation.store,
      referenceId: newLocation.id,
      referenceType: 'location',
      params: [name],
      createdBy: req.user?.fullName || 'System'
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
    _confirmUserUpdate,
    coordinates,
    _image,
    _storeId,
    location: _locationField,
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
      const { url } = await uploadToCloudinaryWithDedup(
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
      modifiedBy: req.user?.id,
      status:
        isActive !== undefined
          ? isActive
            ? 'active'
            : 'inactive'
          : status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'draft'
                : status
            : undefined
    }

    // Handle coordinates mapping
    if (coordinates) {
      if (coordinates.lat) updatedData.latitude = coordinates.lat
      if (coordinates.lng) updatedData.longitude = coordinates.lng
    }

    const [, updatedRows] = await Location.update(updatedData, {
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
      params: [name],
      createdBy: req.user?.fullName || 'System'
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
  { model: InvoiceSetting, action: 'delete' },
  { model: Member, update: { store: null, status: 'inactive' } },
  { model: SocialMedia, update: { store: null, status: 'inactive' } },
  { model: TypePayment, update: { store: null, status: 'inactive' } },
  { model: Shift, update: { store: null, status: 'inactive' } },
  { model: Ingredient, update: { store: null, status: 'inactive' } },
  { model: MemberTier, update: { store: null, status: false } },
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
  { model: User, update: { store: null, status: 'inactive' } }
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

    for (const { model, update, action } of entries) {
      try {
        if (!model) continue
        if (action === 'delete') {
          await model.destroy({ where: { store: dbId } })
        } else {
          await model.update(update, { where: { store: dbId } })
        }
      } catch (modelError) {
        console.error(
          `Error updating ${model?.name || 'unknown'}:`,
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
      params: [location.name],
      createdBy: req.user?.fullName || 'System'
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

    await enrichAuditFields(db, [location])

    const data = {
      id: `loc-${String(location.id).padStart(3, '0')}`,
      storeId: `ST-${String(location.id).padStart(3, '0')}`,
      name: location.name,
      address: location.address,
      detailLocation: location.detailLocation,
      phoneNumber: location.phoneNumber,
      email: location.email,
      image: location.image,
      isActive: location.status === 'active',
      status: location.status,
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
      dailyTarget: location.dailyTarget,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      createdBy: location.createdBy,
      createdByUser: location.dataValues?.createdByUser || null,
      modifiedBy: location.modifiedBy,
      modifiedByUser: location.dataValues?.modifiedByUser || null,
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
