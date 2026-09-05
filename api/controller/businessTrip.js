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

const normalizeBudgetItems = (items = []) =>
  items.map((it) => {
    const qty = it.qty == null ? 0 : Number(it.qty)
    const tarif = it.tarif == null ? 0 : Number(it.tarif)
    return {
      komponen: it.komponen || '',
      qty,
      satuan: it.satuan || '',
      tarif,
      total: qty * tarif,
      catatan: it.catatan || ''
    }
  })

const mapIncludes = (tripSeq) => {
  const employees = (tripSeq.employees || []).map((e) => ({
    id: e.id,
    employeeId: e.employeeId,
    employeeName: e.employeeName,
    employeePosition: e.employeePosition,
    employeeUser: e.employeeUser || null
  }))
  const budgetItems = (tripSeq.budgetItems || []).map((b) => ({
    id: b.id,
    komponen: b.komponen,
    qty: b.qty,
    satuan: b.satuan,
    tarif: b.tarif,
    total: b.total,
    catatan: b.catatan
  }))
  return { employees, budgetItems }
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
  },
  {
    model: dbModels.user,
    as: 'modifiedByUser',
    attributes: ['id', 'userName', 'fullName']
  },
  {
    model: dbModels.businessTripEmployee,
    as: 'employees',
    include: [
      {
        model: dbModels.user,
        as: 'employeeUser',
        attributes: ['id', 'userName', 'fullName']
      }
    ]
  },
  { model: dbModels.businessTripBudgetItem, as: 'budgetItems' }
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

      const data = trips.map((trip) => {
        const { employees, budgetItems } = mapIncludes(trip)
        return {
          id: trip.id,
          tripNumber: trip.tripNumber,
          status: trip.status,
          employeeName: trip.employeeName,
          destination: trip.destination,
          departureDate: trip.departureDate,
          returnDate: trip.returnDate,
          budget: trip.budget,
          employees,
          budgetItems,
          budgetTotal: budgetItems.reduce((s, b) => s + Number(b.total || 0), 0),
          store: trip.storeData
            ? { id: trip.storeData.id, name: trip.storeData.name }
            : null,
          createdByUser: trip.createdByUser,
          modifiedByUser: trip.modifiedByUser,
          approvedByUser: trip.approvedByUser,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt
        }
      })

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
      const resBody = req.body || {}
      const userRole = req.user?.roleType
      const store =
        userRole === 'super_admin' && resBody.store != null
          ? resBody.store
          : req.storeId || req.cookies.store
      const {
        employeeId,
        employeeName,
        employeePosition,
        employees,
        budgetItems,
        destination,
        tripPurpose,
        departureDate,
        returnDate,
        budget,
        notes
      } = resBody
      const createdBy = req.user?.id || null

      if (!destination || !departureDate || !returnDate) {
        return res.status(400).json({
          success: false,
          message: 'destination, departureDate and returnDate are required'
        })
      }

      const employeeRows = Array.isArray(employees)
        ? employees.map((e) => ({
            employeeId: e.employeeId != null ? Number(e.employeeId) : null,
            employeeName: e.employeeName || '',
            employeePosition: e.employeePosition || ''
          }))
        : []

      if (employeeRows.length > 0 && store != null) {
        for (const er of employeeRows) {
          if (er.employeeId == null) continue
          const employee = await db.user.findOne({ where: { id: er.employeeId } })
          if (!employee) {
            return res.status(404).json({
              success: false,
              message: 'Employee not found'
            })
          }
          if (employee.store != null && Number(employee.store) !== Number(store)) {
            return res.status(400).json({
              success: false,
              message: 'Selected employee does not belong to the selected store'
            })
          }
        }
      } else if (employeeId != null && store != null) {
        const employee = await db.user.findOne({ where: { id: employeeId } })
        if (!employee) {
          return res.status(404).json({
            success: false,
            message: 'Employee not found'
          })
        }
        if (employee.store != null && Number(employee.store) !== Number(store)) {
          return res.status(400).json({
            success: false,
            message: 'Selected employee does not belong to the selected store'
          })
        }
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

      if (employeeRows.length > 0) {
        await db.businessTripEmployee.bulkCreate(
          employeeRows.map((r) => ({ ...r, tripId: trip.id }))
        )
      }
      const budgetRows = normalizeBudgetItems(budgetItems)
      if (budgetRows.length > 0) {
        await db.businessTripBudgetItem.bulkCreate(
          budgetRows.map((r) => ({ ...r, tripId: trip.id }))
        )
      }

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
      const resBody = req.body || {}
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
      const patch = { modifiedBy: req.user?.id || null }
      for (const f of fields) {
        if (req.body[f] !== undefined) patch[f] = req.body[f]
      }

      if (userRole === 'super_admin' && resBody.store != null) {
        patch.store = resBody.store
      }

      const effectiveStore = patch.store != null ? patch.store : trip.store
      const effectiveEmployeeId = patch.employeeId != null ? patch.employeeId : trip.employeeId
      if (effectiveEmployeeId != null && effectiveStore != null) {
        const employee = await db.user.findOne({
          where: { id: effectiveEmployeeId }
        })
        if (!employee) {
          return res.status(404).json({
            success: false,
            message: 'Employee not found'
          })
        }
        if (employee.store != null && Number(employee.store) !== Number(effectiveStore)) {
          return res.status(400).json({
            success: false,
            message: 'Selected employee does not belong to the selected store'
          })
        }
      }

      if (trip.status === 'rejected') patch.status = 'draft'

      await trip.update(patch)

      if (Array.isArray(resBody.employees)) {
        const employeeRows = resBody.employees.map((e) => ({
          employeeId: e.employeeId != null ? Number(e.employeeId) : null,
          employeeName: e.employeeName || '',
          employeePosition: e.employeePosition || ''
        }))
        const effectiveStore =
          patch.store != null ? patch.store : trip.store
        if (employeeRows.length > 0 && effectiveStore != null) {
          for (const er of employeeRows) {
            if (er.employeeId == null) continue
            const employee = await db.user.findOne({ where: { id: er.employeeId } })
            if (!employee) {
              return res
                .status(404)
                .json({ success: false, message: 'Employee not found' })
            }
            if (
              employee.store != null &&
              Number(employee.store) !== Number(effectiveStore)
            ) {
              return res.status(400).json({
                success: false,
                message: 'Selected employee does not belong to the selected store'
              })
            }
          }
        }
        await db.businessTripEmployee.destroy({ where: { tripId: trip.id } })
        if (employeeRows.length > 0) {
          await db.businessTripEmployee.bulkCreate(
            employeeRows.map((r) => ({ ...r, tripId: trip.id }))
          )
        }
      }

      if (Array.isArray(resBody.budgetItems)) {
        const budgetRows = normalizeBudgetItems(resBody.budgetItems)
        await db.businessTripBudgetItem.destroy({ where: { tripId: trip.id } })
        if (budgetRows.length > 0) {
          await db.businessTripBudgetItem.bulkCreate(
            budgetRows.map((r) => ({ ...r, tripId: trip.id }))
          )
        }
      }

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
        approvedAt: status === 'approved' ? new Date() : null,
        modifiedBy: req.user?.id || null
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
