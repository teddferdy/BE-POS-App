const db = require('../../db/models')
const { Op } = require('sequelize')

const overviewController = {
  async getProductSummary(req, res) {
    try {
      const { store } = req.query
      const replacements = {}
      let conditions = '1=1'
      if (store) {
        conditions += ` AND "store" = :store`
        replacements.store = store
      }

      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE "status" = 'active') as active,
                COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
         FROM "product" WHERE ${conditions}`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get product summary',
        data: {
          total: Number(result.total),
          active: Number(result.active),
          inactive: Number(result.inactive)
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getCategorySummary(req, res) {
    try {
      const { store } = req.query
      const replacements = {}
      let conditions = '1=1'
      if (store) {
        conditions += ` AND "store" = :store`
        replacements.store = store
      }

      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE "status" = 'active') as active,
                COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
         FROM "category" WHERE ${conditions}`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get category summary',
        data: {
          total: Number(result.total),
          active: Number(result.active),
          inactive: Number(result.inactive)
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getLocationSummary(req, res) {
    try {
      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE "status" = 'active') as active,
                COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
         FROM "location"`,
        { type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get location summary',
        data: {
          total: Number(result.total),
          active: Number(result.active),
          inactive: Number(result.inactive)
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getMemberSummary(req, res) {
    try {
      const { store } = req.query
      const replacements = {}
      let conditions = '1=1'
      if (store) {
        conditions += ` AND "store" = :store`
        replacements.store = store
      }

      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total FROM "member" WHERE ${conditions}`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get member summary',
        data: { total: Number(result.total) }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getUserSummary(req, res) {
    try {
      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total FROM "user"`,
        { type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get user summary',
        data: { total: Number(result.total) }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getBestSelling(req, res) {
    try {
      const { store, limit = 5 } = req.query

      const where = store ? { store } : {}

      const bestSelling = await db.best_selling.findAll({
        where,
        order: [['totalSelling', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get best selling',
        data: bestSelling
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestMembers(req, res) {
    try {
      const { store, limit = 5 } = req.query

      const members = await db.member.findAll({
        where: { store },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest members',
        data: members
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestCategories(req, res) {
    try {
      const { store, limit = 5 } = req.query

      const categories = await db.category.findAll({
        where: { store },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest categories',
        data: categories
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestLocations(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5

      const locations = await db.location.findAll({
        order: [['createdAt', 'DESC']],
        limit
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest locations',
        data: locations
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestProducts(req, res) {
    try {
      const { store, limit = 5 } = req.query

      const products = await db.product.findAll({
        where: { store },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest products',
        data: products
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

module.exports = overviewController
