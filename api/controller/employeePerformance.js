const db = require('../../db/models')
const { Op } = require('sequelize')

const employeePerformanceController = {
  async getPerformance(req, res) {
    try {
      const { store, startDate, endDate, page = 1, limit = 30 } = req.query
      const userStore = req.cookies?.store || req.user?.store

      const where = store || userStore ? { store: store || userStore } : {}
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.kasir_performance.findAndCountAll({
        where,
        include: [
          { model: db.user, as: 'cashierData', attributes: ['id', 'fullName'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['total_sales', 'DESC'], ['report_date', 'DESC']],
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
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getEmployeePerformance(req, res) {
    try {
      const { id } = req.params
      const { store, startDate, endDate, page = 1, limit = 30 } = req.query
      const userStore = req.cookies?.store || req.user?.store

      const where = {
        cashier: parseInt(id)
      }
      if (store || userStore) where.store = store || userStore
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.kasir_performance.findAndCountAll({
        where,
        include: [
          { model: db.user, as: 'cashierData', attributes: ['id', 'fullName', 'userName'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['report_date', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      if (count === 0) {
        return res.status(404).json({ success: false, message: 'No performance data found' })
      }

      const summary = {
        employeeId: parseInt(id),
        employeeName: rows[0].cashierData?.fullName,
        totalRecords: count,
        avgSales: Math.floor(rows.reduce((sum, r) => sum + Number(r.total_sales), 0) / count),
        avgTransactions: Math.floor(rows.reduce((sum, r) => sum + r.transactions, 0) / count),
        avgAccuracy: (rows.reduce((sum, r) => sum + Number(r.accuracy_rate), 0) / count).toFixed(2)
      }

      return res.status(200).json({
        success: true,
        summary,
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit) }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getTopPerformers(req, res) {
    try {
      const { store, startDate, endDate, limit = 10 } = req.query
      const userStore = req.cookies?.store || req.user?.store

      const where = store || userStore ? { store: store || userStore } : {}
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const results = await db.sequelize.query(`
        SELECT 
          cashier,
          SUM(total_sales)::float as total_sales,
          AVG(avg_transaction)::float as avg_transaction,
          AVG(accuracy_rate)::float as avg_accuracy,
          COUNT(*) as days_worked
        FROM kasir_performance
        ${store || userStore ? 'WHERE store = :store' : ''}
          ${startDate ? (store || userStore ? 'AND report_date >= :startDate' : 'WHERE report_date >= :startDate') : ''}
          ${endDate ? (store || userStore || startDate ? 'AND report_date <= :endDate' : 'WHERE report_date <= :endDate') : ''}
        GROUP BY cashier
        ORDER BY total_sales DESC
        LIMIT :limit
      `, {
        replacements: {
          store: store || userStore,
          startDate,
          endDate,
          limit: parseInt(limit)
        },
        type: db.sequelize.QueryTypes.SELECT
      })

      const performersWithNames = await Promise.all(
        results.map(async (result) => {
          const user = await db.user.findByPk(result.cashier, {
            attributes: ['id', 'fullName', 'userName']
          })
          return {
            ...result,
            cashierData: user
          }
        })
      )

      return res.status(200).json({
        success: true,
        data: performersWithNames
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  }
}

module.exports = employeePerformanceController
