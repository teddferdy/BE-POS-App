const db = require('../../db/models')
const { Op } = require('sequelize')

const overviewController = {
  async getDashboard(req, res) {
    try {
      const { store } = req.query

      const [
        products,
        categories,
        locations,
        members,
        users,
        bestSelling
      ] = await Promise.all([
        db.product.findAll({ where: { store }, attributes: ['id', 'status'] }),
        db.category.findAll({ where: { store }, attributes: ['id', 'status'] }),
        db.location.findAll({ attributes: ['id', 'status'] }),
        db.member.findAll({ where: { store }, attributes: ['id'] }),
        db.user.findAll({ attributes: ['id'] }),
        db.best_selling.findAll({
          where: store ? { store } : {},
          order: [['totalSelling', 'DESC']],
          limit: 5
        })
      ])

      const counts = {
        products: {
          total: products.length,
          active: products.filter(p => p.status).length,
          inactive: products.filter(p => !p.status).length
        },
        categories: {
          total: categories.length,
          active: categories.filter(c => c.status).length,
          inactive: categories.filter(c => !c.status).length
        },
        locations: {
          total: locations.length,
          active: locations.filter(l => l.status).length,
          inactive: locations.filter(l => !l.status).length
        },
        members: {
          total: members.length
        },
        users: {
          total: users.length
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Success get dashboard data',
        data: {
          counts,
          bestSelling
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

  async getProductSummary(req, res) {
    try {
      const { store } = req.query

      const products = await db.product.findAll({
        where: { store },
        attributes: ['id', 'status']
      })

      return res.status(200).json({
        success: true,
        message: 'Success get product summary',
        data: {
          total: products.length,
          active: products.filter(p => p.status).length,
          inactive: products.filter(p => !p.status).length
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

  async getCategorySummary(req, res) {
    try {
      const { store } = req.query

      const categories = await db.category.findAll({
        where: { store },
        attributes: ['id', 'status']
      })

      return res.status(200).json({
        success: true,
        message: 'Success get category summary',
        data: {
          total: categories.length,
          active: categories.filter(c => c.status).length,
          inactive: categories.filter(c => !c.status).length
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

  async getLocationSummary(req, res) {
    try {
      const locations = await db.location.findAll({
        attributes: ['id', 'status']
      })

      return res.status(200).json({
        success: true,
        message: 'Success get location summary',
        data: {
          total: locations.length,
          active: locations.filter(l => l.status).length,
          inactive: locations.filter(l => !l.status).length
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

  async getMemberSummary(req, res) {
    try {
      const { store } = req.query

      const members = await db.member.findAll({
        where: { store },
        attributes: ['id']
      })

      return res.status(200).json({
        success: true,
        message: 'Success get member summary',
        data: {
          total: members.length
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

  async getUserSummary(req, res) {
    try {
      const users = await db.user.findAll({
        attributes: ['id']
      })

      return res.status(200).json({
        success: true,
        message: 'Success get user summary',
        data: {
          total: users.length
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
        order: [['id', 'DESC']],
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
        order: [['id', 'DESC']],
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
        order: [['id', 'DESC']],
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
        order: [['id', 'DESC']],
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