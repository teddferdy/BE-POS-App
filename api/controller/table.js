const db = require('../../db/models')
const Table = db.table
const Order = db.order
const Reservation = db.reservation
const Location = db.location
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

exports.getTablesByStore = async (req, res) => {
  const store = req.query.store || req.user?.store
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 10
  const offset = (page - 1) * limit

  try {
    const whereClause = store ? { store } : {}

    const { count, rows } = await Table.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    })

    await enrichAuditFields(db, rows)

    const [locations, activeReservations] = await Promise.all([
      Location.findAll({ attributes: ['id', 'name'], paranoid: false }),
      Reservation.findAll({
        where: { store, status: ['pending', 'confirmed'] },
        attributes: ['id', 'tableId', 'customerName', 'customerPhone', 'startTime', 'endTime', 'reservationDate', 'status']
      })
    ])
    const locMap = {}
    for (const l of locations) locMap[l.id] = l.name
    const reservationByTable = {}
    for (const r of activeReservations) {
      if (r.tableId) reservationByTable[r.tableId] = r
    }
    const data = rows.map((t) => {
      const tJson = t.toJSON()
      tJson.store = { id: tJson.store, name: locMap[tJson.store] || 'Unknown' }
      if (reservationByTable[t.id]) {
        tJson.activeReservation = reservationByTable[t.id]
      }
      return tJson
    })

    const [availableCount, occupiedCount, reservedCount] = await Promise.all([
      Table.count({ where: { ...whereClause, status: 'available' } }),
      Table.count({ where: { ...whereClause, status: 'occupied' } }),
      Table.count({ where: { ...whereClause, status: 'reserved' } })
    ])

    const stats = {
      available: availableCount,
      occupied: occupiedCount,
      reserved: reservedCount,
      total: count
    }

    return res.status(200).json({
      message: 'Success',
      data,
      stats,
      pagination: {
        total: count,
        totalPages: Math.ceil(count / limit),
        page,
        limit
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getTableWithActiveOrders = async (req, res) => {
  const store = req.query.store || req.user?.store

  try {
    const locations = await Location.findAll({ attributes: ['id', 'name'] })
    const locMap = {}
    for (const l of locations) locMap[l.id] = l.name

    const tables = await Table.findAll({
      where: store ? { store } : {},
      include: [
        {
          model: Order,
          as: 'orders',
          where: {
            status: ['pending', 'confirmed', 'preparing', 'ready', 'served']
          },
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    const data = tables.map((t) => {
      const j = t.toJSON()
      j.store = { id: j.store, name: locMap[j.store] || 'Unknown' }
      return j
    })

    return res.status(200).json({
      message: 'Success',
      data
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getTableAvailability = async (req, res) => {
  const store = req.query.store || req.user?.store

  try {
    const tables = await Table.findAll({
      where: store ? { store } : {},
      attributes: ['id', 'name', 'status', 'capacity']
    })

    const summary = {
      available: tables.filter((t) => t.status === 'available').length,
      occupied: tables.filter((t) => t.status === 'occupied').length,
      reserved: tables.filter((t) => t.status === 'reserved').length,
      maintenance: tables.filter((t) => t.status === 'maintenance').length,
      total: tables.length
    }

    return res.status(200).json({
      message: 'Success',
      data: {
        summary,
        tables
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.createTable = async (req, res) => {
  const store = req.body.store || req.user?.store
  const { name, capacity } = req.body

  try {
    const existingTable = await Table.findOne({
      where: { ...(store ? { store } : {}), name }
    })

    if (existingTable) {
      return res.status(400).json({
        message: 'Table number already exists in this store'
      })
    }

    const table = await Table.create({
      store,
      name,
      capacity: capacity || 4,
      status: 'available'
    })

    createAudit(req, 'create', 'table', table.id, `Created table: ${table.id}`)

    return res.status(201).json({
      message: 'Success creating table',
      data: table
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.updateTable = async (req, res) => {
  const store = req.body.store || req.user?.store
  const id = req.params.id || req.body.id
  const { name, capacity, status } = req.body

  try {
    const table = await Table.findOne({
      where: { id, ...(store ? { store } : {}) }
    })

    if (!table) {
      return res.status(404).json({
        message: 'Table not found'
      })
    }

    await table.update({
      name,
      capacity,
      status
    })

    createAudit(req, 'update', 'table', id, `Updated table: ${id}`)

    return res.status(200).json({
      message: 'Success updating table',
      data: table
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.deleteTable = async (req, res) => {
  const { id } = req.params
  const store = req.query.store || req.user?.store

  try {
    const activeOrder = await Order.findOne({
      where: {
        tableId: id,
        status: ['pending', 'confirmed', 'preparing', 'ready', 'served']
      }
    })

    if (activeOrder) {
      return res.status(400).json({
        message: 'Cannot delete table with active orders'
      })
    }

    const whereClause = { id }
    if (store) whereClause.store = store

    const deleted = await Table.destroy({
      where: whereClause
    })

    if (!deleted) {
      return res.status(404).json({
        message: 'Table not found'
      })
    }

    createAudit(req, 'delete', 'table', id, `Deleted table: ${id}`)

    return res.status(200).json({
      message: 'Success deleting table'
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.updateTableStatus = async (req, res) => {
  const store = req.body.store || req.user?.store
  const id = req.params.id || req.body.id
  const { status } = req.body

  try {
    const table = await Table.findOne({
      where: { id, ...(store ? { store } : {}) }
    })

    if (!table) {
      return res.status(404).json({
        message: 'Table not found'
      })
    }

    await table.update({ status })

    if (status === 'available') {
      const activeReservations = await Reservation.findAll({
        where: { tableId: id, status: ['pending', 'confirmed'] }
      })
      for (const r of activeReservations) {
        await r.update({ status: 'completed', modifiedBy: req.user?.id })
      }
    }

    createAudit(req, 'update', 'table', id, `Updated table status: ${id}`)

    return res.status(200).json({
      message: 'Success updating table status',
      data: table
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}
