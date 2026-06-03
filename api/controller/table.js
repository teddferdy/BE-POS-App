const db = require('../../db/models')
const Table = db.table
const Order = db.order
const { createAudit } = require('../../utils/auditLog')

exports.getTablesByStore = async (req, res) => {
  const store = req.query.store || req.user?.store

  try {
    const tables = await Table.findAll({
      where: store ? { store } : {},
      order: [['name', 'ASC']]
    })

    return res.status(200).json({
      message: 'Success',
      data: tables
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
    const tables = await Table.findAll({
      where: store ? { store } : {},
      include: [{
        model: Order,
        as: 'orders',
        where: {
          status: ['pending', 'confirmed', 'preparing', 'ready', 'served']
        },
        required: false
      }],
      order: [['name', 'ASC']]
    })

    return res.status(200).json({
      message: 'Success',
      data: tables
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
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      reserved: tables.filter(t => t.status === 'reserved').length,
      maintenance: tables.filter(t => t.status === 'maintenance').length,
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
  const { name, capacity, createdBy } = req.body

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
      status: 'available',
      createdBy
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
  const { name, capacity, status, modifiedBy } = req.body

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
      status,
      modifiedBy
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

    await Table.destroy({
      where: { id, store },
      force: true
    })

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
  const { status, modifiedBy } = req.body

  try {
    const table = await Table.findOne({
      where: { id, ...(store ? { store } : {}) }
    })

    if (!table) {
      return res.status(404).json({
        message: 'Table not found'
      })
    }

    await table.update({ status, modifiedBy })

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