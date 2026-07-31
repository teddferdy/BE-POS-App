const db = require('../../db/models')
const { Op } = require('sequelize')

const reportingController = {
  async getSalesSummary(req, res) {
    try {
      const { store, startDate, endDate, page = 1, limit = 30 } = req.query
      const userStore = req.cookies?.store
      
      const effectiveStore = store || userStore
      if (!effectiveStore) {
        return res.status(400).json({ success: false, message: 'Store required' })
      }

      const where = { store: effectiveStore }
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.sales_summary.findAndCountAll({
        where,
        include: [{ model: db.location, as: 'storeData', attributes: ['id', 'name'] }],
        order: [['report_date', 'DESC']],
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

  async getProductSalesSummary(req, res) {
    try {
      const { store, startDate, endDate, page = 1, limit = 50 } = req.query
      const userStore = req.cookies?.store

      const where = { store: store || userStore }
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.product_sales_summary.findAndCountAll({
        where,
        include: [
          { model: db.product, as: 'productData', attributes: ['id', 'nameProduct'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['revenue', 'DESC'], ['report_date', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit) }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getCategorySalesSummary(req, res) {
    try {
      const { store, startDate, endDate, page = 1, limit = 20 } = req.query
      const userStore = req.cookies?.store

      const where = { store: store || userStore }
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.category_sales_summary.findAndCountAll({
        where,
        include: [
          { model: db.category, as: 'categoryData', attributes: ['id', 'name'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['revenue', 'DESC'], ['report_date', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit) }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getKasirPerformance(req, res) {
    try {
      const { store, startDate, endDate, page = 1, limit = 30 } = req.query
      const userStore = req.cookies?.store

      const where = { store: store || userStore }
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
        order: [['total_sales', 'DESC'], ['report_date', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit) }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  }
}

module.exports = reportingController
