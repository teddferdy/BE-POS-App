const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const generateTripNumber = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `BT-${year}${month}${day}-${random}`
}

const tripInclude = (dbModels) => [
  { model: dbModels.location, as: 'storeData', attributes: ['id', 'name'] },
  {
    model: dbModels.user,
    as: 'employeeUser',
    attributes: ['id', 'userName', 'fullName']
  },
  {
    model: dbModels.user,
    as: 'approvedByUser',
    attributes: ['id', 'userName', 'fullName']
  },
  {
    model: dbModels.user,
    as: 'createdByUser',
    attributes: ['id', 'userName', 'fullName']
  }
]

const businessTripController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, status, search, queryStore } = req.query
      const where = {}
      const effectiveStore = req.storeId
      const userRole = req.user?.roleType

      if (queryStore && userRole === 'super_admin') where.store = queryStore
      else if (effectiveStore) where.store = effectiveStore

      if (status) where.status = status

      if (search) {
        where[Op.or] = [
          { tripNumber: { [Op.iLike]: `%${search}%` } },
          { employeeName: { [Op.iLike]: `%${search}%` } },
          { destination: { [Op.iLike]: `%${search}%` } },
          { '$storeData.name$': { [Op.iLike]: `%${search}%` } }
        ]
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [trips, total, pendingCount, approvedCount, rejectedCount] =
        await Promise.all([
          db.businessTrip.findAll({
            where,
            include: tripInclude(db),
            order: [['updatedAt', 'DESC']],
            limit: parseInt(limit),
            offset
          }),
          db.businessTrip.count({ where }),
          db.businessTrip.count({ where: { ...where, status: 'pending' } }),
          db.businessTrip.count({ where: { ...where, status: 'approved' } }),
          db.businessTrip.count({ where: { ...where, status: 'rejected' } })
        ])

      const data = trips.map((trip) => ({
        id: trip.id,
        tripNumber: trip.tripNumber,
        status: trip.status,
        employeeName: trip.employeeName,
        destination: trip.destination,
        departureDate: trip.departureDate,
        returnDate: trip.returnDate,
        budget: trip.budget,
        store: trip.storeData
          ? { id: trip.storeData.id, name: trip.storeData.name }
          : null,
        createdByUser: trip.createdByUser,
        modifiedByUser: trip.modifiedByUser,
        approvedByUser: trip.approvedByUser,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt
      }))

      return res.status(200).json({
        success: true,
        message: 'Success',
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          total,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount
        }
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType
      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const trip = await db.businessTrip.findOne({
        where,
        include: tripInclude(db)
      })
      if (!trip) {
        return res
          .status(404)
          .json({ success: false, message: 'Business trip not found' })
      }
      return res
        .status(200)
        .json({ success: true, message: 'Success', data: trip })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const store = req.storeId || req.cookies.store
      const {
        employeeId,
        employeeName,
        employeePosition,
        destination,
        tripPurpose,
        departureDate,
        returnDate,
        budget,
        notes
      } = req.body
      const createdBy = req.user?.id || null

      if (!destination || !departureDate || !returnDate) {
        return res.status(400).json({
          success: false,
          message: 'destination, departureDate and returnDate are required'
        })
      }

      const tripNumber = generateTripNumber()
      const trip = await db.businessTrip.create({
        tripNumber,
        store: store || null,
        status: 'draft',
        employeeId: employeeId || null,
        employeeName: employeeName || '',
        employeePosition: employeePosition || '',
        destination,
        tripPurpose: tripPurpose || '',
        departureDate,
        returnDate,
        budget: budget == null ? null : budget,
        notes: notes || '',
        createdBy
      })

      await createAudit(
        req,
        'create',
        'business_trip',
        trip.id,
        'Created business_trip: ' + trip.id
      )

      const created = await db.businessTrip.findOne({
        where: { id: trip.id },
        include: tripInclude(db)
      })
      return res.status(201).json({
        success: true,
        message: 'Success create business trip',
        data: created
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType
      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const trip = await db.businessTrip.findOne({ where })
      if (!trip) {
        return res
          .status(404)
          .json({ success: false, message: 'Business trip not found' })
      }
      if (!['draft', 'pending', 'rejected'].includes(trip.status)) {
        return res.status(400).json({
          success: false,
          message: 'Only draft, pending or rejected business trip can be updated'
        })
      }

      const fields = [
        'employeeId',
        'employeeName',
        'employeePosition',
        'destination',
        'tripPurpose',
        'departureDate',
        'returnDate',
        'budget',
        'notes'
      ]
      const patch = {}
      for (const f of fields) {
        if (req.body[f] !== undefined) patch[f] = req.body[f]
      }
      if (trip.status === 'rejected') patch.status = 'draft'

      await trip.update(patch)
      await createAudit(
        req,
        'update',
        'business_trip',
        trip.id,
        'Updated business_trip: ' + trip.id
      )

      const updated = await db.businessTrip.findOne({
        where: { id: trip.id },
        include: tripInclude(db)
      })
      return res
        .status(200)
        .json({ success: true, message: 'Success update business trip', data: updated })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType
      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const trip = await db.businessTrip.findOne({ where })
      if (!trip) {
        return res
          .status(404)
          .json({ success: false, message: 'Business trip not found' })
      }
      if (!['draft', 'pending', 'rejected'].includes(trip.status)) {
        return res.status(400).json({
          success: false,
          message: 'Only draft, pending or rejected business trip can be deleted'
        })
      }

      await trip.destroy()
      await createAudit(
        req,
        'delete',
        'business_trip',
        trip.id,
        'Deleted business_trip: ' + trip.id
      )
      return res.status(200).json({
        success: true,
        message: 'Success delete business trip',
        data: { id: trip.id }
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType
      const approvedBy = req.user?.id || null

      const validStatuses = ['approved', 'rejected', 'cancelled', 'pending']
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' })
      }

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const trip = await db.businessTrip.findOne({ where })
      if (!trip) {
        return res
          .status(404)
          .json({ success: false, message: 'Business trip not found' })
      }
      if (trip.status === 'approved' && status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Approved business trip cannot be cancelled'
        })
      }

      await trip.update({
        status,
        approvedBy: status === 'approved' ? approvedBy : null,
        approvedAt: status === 'approved' ? new Date() : null
      })
      await createAudit(
        req,
        status,
        'business_trip',
        trip.id,
        `${status} business_trip: ${trip.id}`
      )
      return res.status(200).json({
        success: true,
        message: `Business trip ${status}`,
        data: { id: trip.id, status }
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = businessTripController
