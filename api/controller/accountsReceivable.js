const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const accountsReceivableController = {
  async list(req, res) {
    try {
      const { store } = req.cookies
      const userRole = req.user?.roleType
      const {
        page = 1,
        limit = 20,
        status,
        customerId,
        startDate,
        endDate
      } = req.query

      const where = {}
      if (store && userRole !== 'super_admin') where.store = store
      if (status) where.status = status
      if (customerId) where.customerId = customerId
      if (startDate || endDate) {
        where.invoiceDate = {}
        if (startDate) where.invoiceDate[Op.gte] = startDate
        if (endDate) where.invoiceDate[Op.lte] = endDate
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.accounts_receivable.findAndCountAll({
        where,
        include: [
          {
            model: db.order,
            as: 'orderData',
            attributes: ['id', 'orderNumber', 'totalPrice', 'createdAt']
          },
          {
            model: db.ar_payment,
            as: 'payments',
            attributes: [
              'id',
              'amount',
              'paymentDate',
              'paymentMethod',
              'reference'
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      // Compute aging and update overdue status
      const now = new Date()
      const enriched = rows.map((ar) => {
        const data = ar.toJSON()
        const due = new Date(data.dueDate)
        const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24))
        let agingBucket = '0-30'
        if (diffDays > 90) agingBucket = '90+'
        else if (diffDays > 60) agingBucket = '61-90'
        else if (diffDays > 30) agingBucket = '31-60'
        data.agingBucket = diffDays > 0 ? agingBucket : '0-30'
        data.overdueDays = diffDays > 0 ? diffDays : 0
        return data
      })

      return res.status(200).json({
        success: true,
        data: enriched,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.error('AR list error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const ar = await db.accounts_receivable.findByPk(id, {
        include: [
          {
            model: db.order,
            as: 'orderData',
            attributes: [
              'id',
              'orderNumber',
              'totalPrice',
              'createdAt',
              'paymentMethod',
              'cashierName',
              'items'
            ]
          },
          { model: db.ar_payment, as: 'payments' }
        ]
      })

      if (!ar) {
        return res.status(404).json({ success: false, message: 'AR not found' })
      }

      const data = ar.toJSON()
      const due = new Date(data.dueDate)
      const diffDays = Math.floor((new Date() - due) / (1000 * 60 * 60 * 24))
      data.overdueDays = diffDays > 0 ? diffDays : 0

      return res.status(200).json({ success: true, data })
    } catch (error) {
      console.error('AR getById error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const { store } = req.cookies
      const {
        orderId,
        customerId,
        customerName,
        totalAmount,
        dueDate,
        creditTerm,
        notes
      } = req.body

      if (!orderId || !totalAmount) {
        return res.status(400).json({
          success: false,
          message: 'Order and total amount are required'
        })
      }

      const order = await db.order.findByPk(orderId)
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: 'Order not found' })
      }

      const invoiceNo = `INV-${order.orderNumber || order.id}-${Date.now()}`
      const today = new Date()

      const ar = await db.accounts_receivable.create({
        store: store || null,
        orderId,
        customerId: customerId || null,
        customerName: customerName || order.customerName || null,
        invoiceNo,
        invoiceDate: today.toISOString().split('T')[0],
        dueDate: dueDate || null,
        creditTerm: creditTerm || null,
        totalAmount: parseInt(totalAmount),
        paidAmount: 0,
        outstandingAmount: parseInt(totalAmount),
        status: 'UNPAID',
        notes: notes || null,
        createdBy: req.user?.id || null
      })

      await createAudit(
        req,
        'create',
        'accounts_receivable',
        ar.id,
        `Created AR: ${invoiceNo} for order: ${orderId}`
      )

      return res
        .status(201)
        .json({ success: true, message: 'AR created successfully', data: ar })
    } catch (error) {
      console.error('AR create error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async recordPayment(req, res) {
    try {
      const { id } = req.params
      const { amount, paymentDate, paymentMethod, reference, notes } = req.body

      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: 'Amount is required' })
      }

      const ar = await db.accounts_receivable.findByPk(id)
      if (!ar) {
        return res.status(404).json({ success: false, message: 'AR not found' })
      }

      if (ar.status === 'PAID') {
        return res
          .status(400)
          .json({ success: false, message: 'AR is already fully paid' })
      }

      // Over-payment guard
      if (Number(ar.paidAmount) + Number(amount) > Number(ar.totalAmount)) {
        const remaining = Number(ar.totalAmount) - Number(ar.paidAmount)
        return res.status(400).json({
          success: false,
          message: `Over-payment not allowed. Remaining: ${remaining}, attempting: ${amount}`
        })
      }

      const payment = await db.ar_payment.create({
        arId: ar.id,
        amount: parseInt(amount),
        paymentDate: paymentDate || new Date(),
        paymentMethod: paymentMethod || 'cash',
        reference: reference || null,
        notes: notes || null,
        createdBy: req.user?.id || null
      })

      const newPaidAmount = Number(ar.paidAmount) + Number(amount)
      const newOutstanding = Number(ar.totalAmount) - newPaidAmount
      const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIAL'

      await ar.update({
        paidAmount: newPaidAmount,
        outstandingAmount: newOutstanding,
        status: newStatus
      })

      await createAudit(
        req,
        'create',
        'ar_payment',
        payment.id,
        `Recorded payment ${payment.id} for AR: ${ar.id}`
      )

      return res
        .status(201)
        .json({ success: true, message: 'Payment recorded', data: payment })
    } catch (error) {
      console.error('AR payment error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async agingReport(req, res) {
    try {
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { status: { [Op.ne]: 'PAID' } }
      if (store && userRole !== 'super_admin') where.store = store

      const arList = await db.accounts_receivable.findAll({
        where,
        include: [
          {
            model: db.order,
            as: 'orderData',
            attributes: ['id', 'orderNumber']
          },
          {
            model: db.ar_payment,
            as: 'payments',
            attributes: ['id', 'amount', 'paymentDate']
          }
        ],
        order: [['dueDate', 'ASC']]
      })

      const now = new Date()
      const buckets = {
        '0-30': { label: '0-30 Hari', data: [], total: 0 },
        '31-60': { label: '31-60 Hari', data: [], total: 0 },
        '61-90': { label: '61-90 Hari', data: [], total: 0 },
        '90+': { label: '90+ Hari', data: [], total: 0 }
      }

      for (const ar of arList) {
        const data = ar.toJSON()
        const due = new Date(data.dueDate)
        const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24))

        let bucket = '0-30'
        if (diffDays > 90) bucket = '90+'
        else if (diffDays > 60) bucket = '61-90'
        else if (diffDays > 30) bucket = '31-60'

        data.overdueDays = diffDays > 0 ? diffDays : 0
        buckets[bucket].data.push(data)
        buckets[bucket].total += Number(data.outstandingAmount || 0)
      }

      const grandTotal = Object.values(buckets).reduce((s, b) => s + b.total, 0)

      return res.status(200).json({
        success: true,
        data: { buckets, grandTotal }
      })
    } catch (error) {
      console.error('AR aging error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { dueDate, creditTerm, notes, status } = req.body

      const ar = await db.accounts_receivable.findByPk(id)
      if (!ar) {
        return res.status(404).json({ success: false, message: 'AR not found' })
      }

      const updates = {}
      if (dueDate) updates.dueDate = dueDate
      if (creditTerm) updates.creditTerm = creditTerm
      if (notes !== undefined) updates.notes = notes
      if (status) updates.status = status
      updates.modifiedBy = req.user?.id || null

      await ar.update(updates)
      await createAudit(
        req,
        'update',
        'accounts_receivable',
        id,
        `Updated AR: ${ar.invoiceNo}`
      )

      return res
        .status(200)
        .json({ success: true, message: 'AR updated', data: ar })
    } catch (error) {
      console.error('AR update error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const ar = await db.accounts_receivable.findByPk(id)
      if (!ar) {
        return res.status(404).json({ success: false, message: 'AR not found' })
      }

      await db.ar_payment.destroy({ where: { arId: id } })
      await ar.destroy()

      await createAudit(
        req,
        'delete',
        'accounts_receivable',
        id,
        `Deleted AR: ${ar.invoiceNo}`
      )

      return res.status(200).json({ success: true, message: 'AR deleted' })
    } catch (error) {
      console.error('AR delete error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = accountsReceivableController
