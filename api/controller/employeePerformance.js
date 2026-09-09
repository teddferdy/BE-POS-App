const db = require('../../db/models')
const { Op } = require('sequelize')

const employeePerformanceController = {
  async getPerformance(req, res) {
    try {
      const { startDate, endDate, page = 1, limit = 30 } = req.query
      const effectiveStore = req.storeId ?? req.user?.store
      if (!effectiveStore && req.user?.roleType !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Store assignment required' })
      }

      const where = effectiveStore ? { store: effectiveStore } : {}
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
        order: [
          ['total_sales', 'DESC'],
          ['report_date', 'DESC']
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
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getEmployeePerformance(req, res) {
    try {
      const { id } = req.params
      const { startDate, endDate, page = 1, limit = 30 } = req.query
      const effectiveStore = req.storeId ?? req.user?.store
      if (!effectiveStore && req.user?.roleType !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Store assignment required' })
      }

      const where = {
        cashier: parseInt(id)
      }
      if (effectiveStore) where.store = effectiveStore
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.kasir_performance.findAndCountAll({
        where,
        include: [
          {
            model: db.user,
            as: 'cashierData',
            attributes: ['id', 'fullName', 'userName']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['report_date', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      if (count === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'No performance data found' })
      }

      const summary = {
        employeeId: parseInt(id),
        employeeName: rows[0].cashierData?.fullName,
        totalRecords: count,
        avgSales: Math.floor(
          rows.reduce((sum, r) => sum + Number(r.total_sales), 0) / count
        ),
        avgTransactions: Math.floor(
          rows.reduce((sum, r) => sum + r.transactions, 0) / count
        ),
        avgAccuracy: (
          rows.reduce((sum, r) => sum + Number(r.accuracy_rate), 0) / count
        ).toFixed(2)
      }

      return res.status(200).json({
        success: true,
        summary,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getTopPerformers(req, res) {
    try {
      const { startDate, endDate, limit = 10 } = req.query
      const effectiveStore = req.storeId ?? req.user?.store
      if (!effectiveStore && req.user?.roleType !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Store assignment required' })
      }

      const safeLimit = Math.min(Math.max(1, parseInt(limit) || 10), 100)

      const where = {}
      if (effectiveStore) where.store = String(effectiveStore)
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const results = await db.kasir_performance.findAll({
        where,
        attributes: [
          'cashier',
          [db.sequelize.fn('SUM', db.sequelize.col('total_sales')), 'total_sales'],
          [db.sequelize.fn('AVG', db.sequelize.col('avg_transaction')), 'avg_transaction'],
          [db.sequelize.fn('AVG', db.sequelize.col('accuracy_rate')), 'avg_accuracy'],
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'days_worked']
        ],
        group: ['cashier'],
        order: [[db.sequelize.literal('total_sales'), 'DESC']],
        limit: safeLimit,
        raw: true
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
