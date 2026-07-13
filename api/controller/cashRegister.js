const db = require('../../db/models')
const { Op } = require('sequelize')
const { enrichAuditFields } = require('../../utils/auditFields')

const getStore = (req) =>
  req.body.storeId ||
  req.body.store ||
  req.query.store ||
  req.cookies.store ||
  req.cookies.activeStore ||
  req.user?.store

const cashRegisterController = {
  async open(req, res) {
    try {
      const store = getStore(req)
      const { openingBalance = 0, shift } = req.body
      const userId = req.user?.id || null

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      const openRegister = await db.cashRegister.findOne({
        where: { store, user: userId, status: 'open' }
      })

      if (openRegister) {
        return res.status(400).json({
          success: false,
          message: 'You already have an open register'
        })
      }

      const cashRegister = await db.cashRegister.create({
        store,
        user: userId,
        shift,
        openingBalance,
        status: 'open',
        openedAt: new Date()
      })

      const location = await db.location.findByPk(store, {
        attributes: ['id', 'name', 'address', 'city']
      })

      return res.status(201).json({
        success: true,
        message: 'Cash register opened',
        data: { ...cashRegister.toJSON(), storeData: location }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async close(req, res) {
    try {
      const { id } = req.params
      const store = getStore(req)
      const { closingBalance, notes } = req.body

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      const cashRegister = await db.cashRegister.findOne({
        where: { id, store, status: 'open' },
        include: [
          { model: db.user, as: 'userData', attributes: ['id', 'fullName'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ]
      })

      if (!cashRegister) {
        return res.status(404).json({
          success: false,
          message: 'Open cash register not found'
        })
      }

      const orders = await db.order.findAll({
        where: {
          store,
          createdBy: cashRegister.user,
          createdAt: {
            [Op.gte]: cashRegister.openedAt,
            [Op.lte]: new Date()
          },
          paymentStatus: 'paid'
        },
        include: [{ model: db.transaction, as: 'transactions' }]
      })

      let totalSales = 0
      let totalPayments = {}

      for (const order of orders) {
        totalSales += order.totalPrice || 0

        if (order.transactions) {
          for (const tx of order.transactions) {
            const method = tx.typePayment || 'cash'
            totalPayments[method] = (totalPayments[method] || 0) + tx.amount
          }
        }
      }

      const expenses = await db.expense.findAll({
        where: {
          store,
          createdBy: cashRegister.user,
          date: {
            [Op.gte]: cashRegister.openedAt,
            [Op.lte]: new Date()
          },
          status: 'approved'
        }
      })

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

      await cashRegister.update({
        closingBalance: closingBalance || 0,
        totalSales,
        totalExpenses,
        totalPayments,
        status: 'closed',
        closedAt: new Date(),
        notes
      })

      return res.status(200).json({
        success: true,
        message: 'Cash register closed',
        data: {
          register: cashRegister,
          summary: {
            openingBalance: cashRegister.openingBalance,
            closingBalance: closingBalance || 0,
            totalSales,
            totalExpenses,
            totalPayments,
            expectedCash:
              cashRegister.openingBalance + totalSales - totalExpenses,
            variance:
              (closingBalance || 0) -
              (cashRegister.openingBalance + totalSales - totalExpenses)
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

  async getCurrent(req, res) {
    try {
      const store = getStore(req)
      const userId = req.user?.id || null

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      const cashRegister = await db.cashRegister.findOne({
        where: { store, user: userId, status: 'open' },
        include: [
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name', 'address', 'city']
          }
        ]
      })

      if (!cashRegister) {
        return res.status(200).json({
          success: true,
          message: 'No open cash register',
          data: null
        })
      }

      const orders = await db.order.findAll({
        where: {
          store,
          createdBy: userId,
          createdAt: {
            [Op.gte]: cashRegister.openedAt
          },
          paymentStatus: 'paid'
        },
        attributes: ['id', 'totalPrice', 'createdAt']
      })

      const totalSales = orders.reduce(
        (sum, order) => sum + (order.totalPrice || 0),
        0
      )

      const expenses = await db.expense.findAll({
        where: {
          store,
          createdBy: userId,
          date: { [Op.gte]: cashRegister.openedAt },
          status: 'approved'
        },
        attributes: ['id', 'amount', 'description', 'date']
      })

      const totalExpenses = expenses.reduce(
        (sum, exp) => sum + Number(exp.amount || 0),
        0
      )

      return res.status(200).json({
        success: true,
        message: 'Success get current register',
        data: {
          register: cashRegister,
          currentSales: totalSales,
          totalExpenses,
          expenses,
          totalTransactions: orders.length,
          expectedCash: cashRegister.openingBalance + totalSales - totalExpenses
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

  async getHistory(req, res) {
    try {
      const store = getStore(req)
      const { startDate, endDate, page = 1, limit = 50, search } = req.query
      const isSuperAdmin = req.user?.roleType === 'super_admin'

      const where = {}
      if (store) {
        where.store = store
      } else if (!isSuperAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      if (search) {
        where[Op.or] = [
          { '$userData.fullName$': { [Op.iLike]: `%${search}%` } },
          { '$storeData.name$': { [Op.iLike]: `%${search}%` } },
          { status: { [Op.iLike]: `%${search}%` } }
        ]
      }

      if (startDate || endDate) {
        where.openedAt = {}
        if (startDate) where.openedAt[Op.gte] = new Date(startDate)
        if (endDate) where.openedAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.cashRegister.findAndCountAll({
        where,
        include: [
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name', 'address', 'city']
          }
        ],
        order: [['openedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      await enrichAuditFields(db, rows)

      // ponytail: compute live totals for open registers since DB stores 0 until close
      const enriched = await Promise.all(
        rows.map(async (row) => {
          if (row.status !== 'open') return row
          const data = row.get({ plain: true })
          const [orders, expenses] = await Promise.all([
            db.order.findAll({
              where: {
                store: data.store,
                createdBy: data.user,
                createdAt: { [Op.gte]: data.openedAt },
                paymentStatus: 'paid'
              },
              attributes: ['totalPrice']
            }),
            db.expense.findAll({
              where: {
                store: data.store,
                createdBy: data.user,
                date: { [Op.gte]: data.openedAt },
                status: 'approved'
              },
              attributes: ['amount']
            })
          ])
          data.totalSales = orders.reduce(
            (s, o) => s + Number(o.totalPrice || 0),
            0
          )
          data.totalExpenses = expenses.reduce(
            (s, e) => s + Number(e.amount || 0),
            0
          )
          // ponytail: expectedCash is not stored in history but computed on detail page anyway
          return data
        })
      )

      return res.status(200).json({
        success: true,
        message: 'Success get register history',
        data: enriched,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
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

module.exports = cashRegisterController
