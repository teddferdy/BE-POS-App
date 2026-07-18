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

      const now = new Date()
      const replacements = {
        store,
        user: cashRegister.user,
        openedAt: cashRegister.openedAt,
        now
      }

      const [salesAgg] = await db.sequelize.query(
        `SELECT COALESCE(SUM("totalPrice"), 0) as "totalSales"
         FROM "order"
         WHERE "store" = :store AND "createdBy" = :user
           AND "createdAt" >= :openedAt AND "createdAt" <= :now
           AND "paymentStatus" = 'paid'`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )

      const paymentRows = await db.sequelize.query(
        `SELECT t."typePayment", COALESCE(SUM(t."amount"), 0) as total
         FROM "transaction" t
         JOIN "order" o ON o.id = t."order"
         WHERE o."store" = :store AND o."createdBy" = :user
           AND o."createdAt" >= :openedAt AND o."createdAt" <= :now
           AND o."paymentStatus" = 'paid'
         GROUP BY t."typePayment"`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )

      let totalSales = Number(salesAgg.totalSales || 0)
      let totalPayments = {}
      for (const row of paymentRows) {
        totalPayments[row.typePayment || 'cash'] = Number(row.total || 0)
      }

      const [expAgg] = await db.sequelize.query(
        `SELECT COALESCE(SUM("amount"), 0) as "totalExpenses"
         FROM expense
         WHERE "store" = :store AND "createdBy" = :user
           AND "date" >= :openedAt AND "date" <= :now
           AND "status" = 'approved'`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )

      const totalExpenses = Number(expAgg.totalExpenses || 0)

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

      const replacements = {
        store,
        user: userId,
        openedAt: cashRegister.openedAt
      }

      const [salesAgg, expAgg] = await Promise.all([
        db.sequelize
          .query(
            `SELECT COUNT(*) as "totalTransactions",
                  COALESCE(SUM("totalPrice"), 0) as "totalSales"
           FROM "order"
           WHERE "store" = :store AND "createdBy" = :user
             AND "createdAt" >= :openedAt AND "paymentStatus" = 'paid'`,
            { replacements, type: db.sequelize.QueryTypes.SELECT }
          )
          .then((r) => r[0]),
        db.sequelize
          .query(
            `SELECT COALESCE(SUM("amount"), 0) as "totalExpenses"
           FROM expense
           WHERE "store" = :store AND "createdBy" = :user
             AND "date" >= :openedAt AND "status" = 'approved'`,
            { replacements, type: db.sequelize.QueryTypes.SELECT }
          )
          .then((r) => r[0])
      ])

      const totalSales = Number(salesAgg.totalSales || 0)
      const totalExpenses = Number(expAgg.totalExpenses || 0)

      return res.status(200).json({
        success: true,
        message: 'Success get current register',
        data: {
          register: cashRegister,
          currentSales: totalSales,
          totalExpenses,
          totalTransactions: Number(salesAgg.totalTransactions || 0),
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

      const openRegisters = rows.filter((r) => r.status === 'open')

      let salesMap = {}
      let expenseMap = {}
      let transactionsMap = {}

      if (openRegisters.length > 0) {
        const salesQueries = openRegisters.map(async (row) => {
          const d = row.get({ plain: true })
          const [result] = await db.sequelize.query(
            `SELECT COUNT(*) as "totalTransactions",
                    COALESCE(SUM("totalPrice"), 0) as "totalSales"
             FROM "order"
             WHERE "store" = :store AND "createdBy" = :user
               AND "createdAt" >= :openedAt AND "paymentStatus" = 'paid'`,
            {
              replacements: {
                store: d.store,
                user: d.user,
                openedAt: d.openedAt
              },
              type: db.sequelize.QueryTypes.SELECT
            }
          )
          salesMap[d.id] = {
            totalSales: Number(result.totalSales || 0),
            totalTransactions: Number(result.totalTransactions || 0)
          }
        })

        const expenseQueries = openRegisters.map(async (row) => {
          const d = row.get({ plain: true })
          const [result] = await db.sequelize.query(
            `SELECT COALESCE(SUM("amount"), 0) as "totalExpenses"
             FROM expense
             WHERE "store" = :store AND "createdBy" = :user
               AND "date" >= :openedAt AND "status" = 'approved'`,
            {
              replacements: {
                store: d.store,
                user: d.user,
                openedAt: d.openedAt
              },
              type: db.sequelize.QueryTypes.SELECT
            }
          )
          expenseMap[d.id] = Number(result.totalExpenses || 0)
        })

        await Promise.all([...salesQueries, ...expenseQueries])
      }

      const enriched = rows.map((row) => {
        if (row.status !== 'open') return row
        const data = row.get({ plain: true })
        const sales = salesMap[data.id] || {
          totalSales: 0,
          totalTransactions: 0
        }
        data.totalSales = sales.totalSales
        data.totalExpenses = expenseMap[data.id] || 0
        return data
      })

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
