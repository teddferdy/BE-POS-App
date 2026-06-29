const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const purchasePaymentController = {
  async getById(req, res) {
    try {
      const { id } = req.params
      const payment = await db.purchase_payment.findByPk(id, {
        include: [
          {
            model: db.purchase_order,
            as: 'purchaseOrderData',
            attributes: ['id', 'orderNumber', 'finalAmount', 'status']
          },
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name', 'phone']
          },
          {
            model: db.user,
            as: 'createdByUser',
            attributes: ['id', 'userName', 'fullName']
          }
        ]
      })
      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: 'Payment not found' })
      }
      return res.status(200).json({ success: true, data: payment })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getByPO(req, res) {
    try {
      const { poId } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { purchaseOrder: poId }
      if (store && userRole !== 'super_admin') where.store = store

      const payments = await db.purchase_payment.findAll({
        where,
        order: [['paymentDate', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        data: payments
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getBySupplier(req, res) {
    try {
      const { supplierId } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const poWhere = { supplier: supplierId }
      if (store && userRole !== 'super_admin') poWhere.store = store

      const purchaseOrders = await db.purchase_order.findAll({
        where: poWhere,
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name']
          },
          { model: db.purchase_payment, as: 'payments' }
        ],
        order: [['createdAt', 'DESC']]
      })

      const totalOrdered = purchaseOrders.reduce(
        (sum, po) => sum + Number(po.finalAmount || 0),
        0
      )
      let totalPaid = 0
      for (const po of purchaseOrders) {
        if (po.payments) {
          totalPaid += po.payments.reduce(
            (s, p) => s + Number(p.amount || 0),
            0
          )
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          purchaseOrders,
          summary: {
            totalOrdered,
            totalPaid,
            balance: totalOrdered - totalPaid
          }
        }
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async record(req, res) {
    try {
      const { store } = req.cookies
      const {
        purchaseOrder,
        supplier,
        amount,
        paymentDate,
        paymentMethod,
        reference,
        notes
      } = req.body

      if (!purchaseOrder || !supplier || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Purchase order, supplier, and amount are required'
        })
      }

      // Over-payment guard
      const po = await db.purchase_order.findByPk(purchaseOrder)
      if (!po) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      const existingPayments = await db.purchase_payment.sum('amount', {
        where: { purchaseOrder, deletedAt: null }
      })
      const totalPaid = existingPayments || 0
      if (totalPaid + Number(amount) > Number(po.finalAmount)) {
        return res.status(400).json({
          success: false,
          message: `Over-payment not allowed. Total paid: ${totalPaid}, remaining: ${Number(po.finalAmount) - totalPaid}, attempting to pay: ${amount}`
        })
      }

      const payment = await db.purchase_payment.create({
        store: store || null,
        purchaseOrder,
        supplier,
        amount: parseInt(amount),
        paymentDate: paymentDate || new Date(),
        paymentMethod: paymentMethod || 'cash',
        reference: reference || null,
        notes: notes || null,
        createdBy: req.user?.id || null
      })

      await createAudit(
        req,
        'create',
        'purchase_payment',
        payment.id,
        'Recorded payment: ' + payment.id + ' for PO: ' + purchaseOrder
      )

      // Auto-update PO status to 'received' if fully paid
      const newTotalPaid = totalPaid + Number(amount)
      if (newTotalPaid >= Number(po.finalAmount) && po.status !== 'received') {
        await po.update({ status: 'received' })
      }

      return res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: payment
      })
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
      const payment = await db.purchase_payment.findByPk(id)
      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: 'Payment not found' })
      }

      await payment.destroy()

      await createAudit(
        req,
        'delete',
        'purchase_payment',
        id,
        'Deleted payment: ' + id
      )

      return res
        .status(200)
        .json({ success: true, message: 'Payment deleted successfully' })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async list(req, res) {
    try {
      const { store } = req.cookies
      const userRole = req.user?.roleType
      const { page = 1, limit = 20, startDate, endDate, supplierId } = req.query

      const where = {}
      if (store && userRole !== 'super_admin') where.store = store
      if (supplierId) where.supplier = supplierId
      if (startDate || endDate) {
        where.paymentDate = {}
        if (startDate) where.paymentDate[Op.gte] = startDate
        if (endDate) where.paymentDate[Op.lte] = endDate
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.purchase_payment.findAndCountAll({
        where,
        include: [
          {
            model: db.purchase_order,
            as: 'purchaseOrderData',
            attributes: ['id', 'orderNumber', 'finalAmount', 'status']
          },
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name']
          }
        ],
        order: [
          ['paymentDate', 'DESC'],
          ['createdAt', 'DESC']
        ],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = purchasePaymentController
