const Table = require('../../db/models/table')
const Order = require('../../db/models/order')

exports.getTablesByStore = async (req, res) => {
  const { store } = req.query

  try {
    const tables = await Table.findAll({
      where: { store },
      order: [['tableNumber', 'ASC']]
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
  const { store } = req.query

  try {
    const tables = await Table.findAll({
      where: { store },
      include: [{
        model: Order,
        as: 'orders',
        where: {
          status: ['pending', 'confirmed', 'preparing', 'ready', 'served']
        },
        required: false
      }],
      order: [['tableNumber', 'ASC']]
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
  const { store } = req.query

  try {
    const tables = await Table.findAll({
      where: { store },
      attributes: ['id', 'tableNumber', 'tableName', 'status', 'capacity']
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
  const { store, tableNumber, tableName, capacity, position, createdBy } = req.body

  try {
    const existingTable = await Table.findOne({
      where: { store, tableNumber }
    })

    if (existingTable) {
      return res.status(400).json({
        message: 'Table number already exists in this store'
      })
    }

    const table = await Table.create({
      store,
      tableNumber,
      tableName,
      capacity: capacity || 4,
      position,
      status: 'available',
      createdBy
    })

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
  const { id, store, tableNumber, tableName, capacity, position, status, modifiedBy } = req.body

  try {
    const table = await Table.findOne({
      where: { id, store }
    })

    if (!table) {
      return res.status(404).json({
        message: 'Table not found'
      })
    }

    await table.update({
      tableNumber,
      tableName,
      capacity,
      position,
      status,
      modifiedBy
    })

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
  const { store } = req.query

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
  const { id, store, status, modifiedBy } = req.body

  try {
    const table = await Table.findOne({
      where: { id, store }
    })

    if (!table) {
      return res.status(404).json({
        message: 'Table not found'
      })
    }

    await table.update({ status, modifiedBy })

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