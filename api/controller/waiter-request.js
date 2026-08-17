const db = require('../../db/models')
const { Op } = require('sequelize')
const { enrichAuditFields } = require('../../utils/auditFields')
const { emitToStore } = require('../service/socket')

const generateRequestNumber = () => {
  const date = new Date()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `WR${hours}${minutes}-${random}`
}

const waiterRequestController = {
  // ——— Public (no auth) — customer submits a waiter request ———
  async customerCreate(req, res) {
    const { store, tableId, orderId, type, notes, customerName } = req.body

    try {
      if (!store || !type) {
        return res.status(400).json({ message: 'store and type are required' })
      }

      const storeId = Number(store)
      if (isNaN(storeId)) {
        return res.status(400).json({ message: 'Invalid store value' })
      }

      const allowedTypes = ['sendok', 'tisu', 'refill', 'bill', 'call']
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid request type' })
      }

      const requestNumber = generateRequestNumber()

      const tableIdNum =
        tableId === '' || tableId == null ? null : Number(tableId)
      const orderIdNum =
        orderId === '' || orderId == null ? null : Number(orderId)

      const waiterRequest = await db.waiter_request.create({
        store: [storeId],
        requestNumber,
        tableId: Number.isInteger(tableIdNum) ? tableIdNum : null,
        orderId: Number.isInteger(orderIdNum) ? orderIdNum : null,
        type,
        notes: notes || null,
        customerName: customerName || null,
        status: 'pending'
      })

      const fullRequest = await db.waiter_request.findByPk(waiterRequest.id, {
        include: [
          { model: db.table, as: 'table', attributes: ['id', 'name'] },
          { model: db.order, as: 'order', attributes: ['id', 'orderNumber'] }
        ]
      })

      emitToStore(storeId, 'waiter-request:new', fullRequest)
      emitToStore(storeId, 'new-notification', {
        type: 'waiter_request',
        referenceId: waiterRequest.id,
        title: 'Permintaan Pelayan Baru',
        message: `${type} dari meja ${tableId ? `#${tableId}` : '-'}`,
        createdAt: new Date().toISOString()
      })

      return res.status(201).json({
        success: true,
        message: 'Waiter request created',
        data: fullRequest
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },

  // ——— Public — customer views their own requests (by store + table) ———
  async getCustomerList(req, res) {
    try {
      const { store, tableId, limit = 50 } = req.query
      const storeId = Number(store)
      if (isNaN(storeId)) {
        return res.status(400).json({ message: 'Invalid store value' })
      }

      const where = { store: { [Op.contains]: [storeId] } }
      if (tableId) {
        const tableNum = Number(tableId)
        if (!isNaN(tableNum)) {
          where.tableId = tableNum
        }
      }

      const requests = await db.waiter_request.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: Number(limit),
        include: [
          { model: db.table, as: 'table', attributes: ['id', 'name'] },
          { model: db.order, as: 'order', attributes: ['id', 'orderNumber'] }
        ]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get customer waiter requests',
        data: requests
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },

  // ——— Admin — list pending requests ———
  async getPendingList(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query
      const store = req.query.store || req.user?.store

      const where = { status: 'pending' }
      if (store) {
        const storeId = Number(store)
        if (!isNaN(storeId)) {
          where.store = { [Op.contains]: [storeId] }
        }
      }

      const offset = (Number(page) - 1) * Number(limit)

      const [requests, total] = await Promise.all([
        db.waiter_request.findAll({
          where,
          order: [['createdAt', 'ASC']],
          limit: Number(limit),
          offset,
          include: [
            { model: db.table, as: 'table', attributes: ['id', 'name'] },
            { model: db.order, as: 'order', attributes: ['id', 'orderNumber'] }
          ]
        }),
        db.waiter_request.count({ where })
      ])

      await enrichAuditFields(db, requests)

      return res.status(200).json({
        success: true,
        message: 'Success get waiter requests',
        data: requests,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },

  // ——— Admin — list all requests with optional status filter ———
  async getList(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query
      const store = req.query.store || req.user?.store

      const where = {}
      if (status && status !== 'all') where.status = status
      if (store) {
        const storeId = Number(store)
        if (!isNaN(storeId)) {
          where.store = { [Op.contains]: [storeId] }
        }
      }

      const offset = (Number(page) - 1) * Number(limit)

      const [requests, total] = await Promise.all([
        db.waiter_request.findAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: Number(limit),
          offset,
          include: [
            { model: db.table, as: 'table', attributes: ['id', 'name'] },
            { model: db.order, as: 'order', attributes: ['id', 'orderNumber'] }
          ]
        }),
        db.waiter_request.count({ where })
      ])

      await enrichAuditFields(db, requests)

      return res.status(200).json({
        success: true,
        message: 'Success get waiter requests',
        data: requests,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },

  // ——— Admin — update status (approve/reject/done) ———
  async updateStatus(req, res) {
    try {
      const { id } = req.params
      const { status, notes } = req.body

      const waiterRequest = await db.waiter_request.findByPk(id)
      if (!waiterRequest) {
        return res
          .status(404)
          .json({ success: false, message: 'Waiter request not found' })
      }

      const allowedStatus = ['pending', 'approved', 'rejected', 'done']
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' })
      }

      const updates = {
        status,
        resolvedBy: req.user?.id || null,
        modifiedBy: req.user?.id || null
      }

      if (status === 'approved' || status === 'rejected' || status === 'done') {
        updates.resolvedAt = new Date()
      }

      if (notes !== undefined) {
        updates.notes = notes
      }

      await waiterRequest.update(updates)

      const fullRequest = await db.waiter_request.findByPk(id, {
        include: [
          { model: db.table, as: 'table', attributes: ['id', 'name'] },
          { model: db.order, as: 'order', attributes: ['id', 'orderNumber'] }
        ]
      })

      const storeId = Array.isArray(waiterRequest.store)
        ? waiterRequest.store[0]
        : waiterRequest.store
      emitToStore(storeId, 'waiter-request:statusChanged', fullRequest)

      return res.status(200).json({
        success: true,
        message: `Waiter request ${status}`,
        data: fullRequest
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

module.exports = waiterRequestController
