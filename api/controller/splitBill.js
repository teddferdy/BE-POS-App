const db = require('../../db/models')
const { createAudit } = require('../../utils/auditLog')

const generateSplitNumber = () => {
  const date = new Date()
  const timestamp = date.getTime().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SPL${timestamp}${random}`
}

const splitBillController = {
  async create(req, res) {
    try {
      const { order, items } = req.body
      const createdBy = req.user?.id || null

      if (!order || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order and items are required'
        })
      }

      const existingSplits = await db.split_bill.findAll({
        where: { order }
      })

      if (existingSplits.length > 0 && existingSplits.some(s => s.status === 'pending')) {
        return res.status(400).json({
          success: false,
          message: 'Order already has pending split bills. Complete or cancel them first.'
        })
      }

      const splits = await Promise.all(items.map(item => {
        return db.split_bill.create({
          order,
          splitNumber: generateSplitNumber(),
          amount: item.amount,
          status: 'pending',
          createdBy
        })
      }))

      await createAudit(req, 'create', 'split_bill', splits[0]?.id, 'Created split_bill for order: ' + order)

      return res.status(201).json({
        success: true,
        message: 'Success create split bills',
        data: splits
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getByOrder(req, res) {
    try {
      const { orderId } = req.params

      const splits = await db.split_bill.findAll({
        where: { order: orderId },
        order: [['createdAt', 'DESC']]
      })

      const totalPaid = splits
        .filter(s => s.status === 'paid')
        .reduce((sum, s) => sum + s.amount, 0)

      const totalPending = splits
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + s.amount, 0)

      return res.status(200).json({
        success: true,
        message: 'Success get split bills',
        data: {
          splits,
          summary: {
            totalSplits: splits.length,
            totalPaid,
            totalPending
          }
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async pay(req, res) {
    try {
      const { id } = req.params
      const { paymentMethod } = req.body

      const split = await db.split_bill.findByPk(id)

      if (!split) {
        return res.status(404).json({
          success: false,
          message: 'Split bill not found'
        })
      }

      if (split.status === 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Split bill already paid'
        })
      }

      await split.update({
        status: 'paid',
        paymentMethod
      })

      await createAudit(req, 'update', 'split_bill', split.id, 'Updated split_bill: ' + split.id)

      const allSplits = await db.split_bill.findAll({
        where: { order: split.order }
      })

      const allPaid = allSplits.every(s => s.status === 'paid')

      if (allPaid) {
        const order = await db.order.findByPk(split.order)
        if (order) {
          await order.update({
            paymentStatus: 'paid',
            status: 'paid'
          })

          if (order.tableId) {
            await db.table.update(
              { status: 'available' },
              { where: { id: order.tableId } }
            )
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Success pay split bill',
        data: {
          split,
          orderComplete: allPaid
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async cancel(req, res) {
    try {
      const { id } = req.params

      const split = await db.split_bill.findByPk(id)

      if (!split) {
        return res.status(404).json({
          success: false,
          message: 'Split bill not found'
        })
      }

      await split.destroy()

      await createAudit(req, 'delete', 'split_bill', id, 'Deleted split_bill: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success cancel split bill'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async merge(req, res) {
    try {
      const { order, splitIds } = req.body

      if (!splitIds || splitIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'At least 2 split bills required to merge'
        })
      }

      const splits = await db.split_bill.findAll({
        where: {
          id: { [db.Sequelize.Op.in]: splitIds },
          order,
          status: 'pending'
        }
      })

      if (splits.length !== splitIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some split bills not found or already paid'
        })
      }

      const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0)

      await db.split_bill.destroy({
        where: { id: { [db.Sequelize.Op.in]: splitIds } }
      })

      const newSplit = await db.split_bill.create({
        order,
        splitNumber: generateSplitNumber(),
        amount: totalAmount,
        status: 'pending'
      })

      await createAudit(req, 'update', 'split_bill', newSplit.id, 'Merged split_bill: ' + newSplit.id)

      return res.status(201).json({
        success: true,
        message: 'Success merge split bills',
        data: newSplit
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = splitBillController