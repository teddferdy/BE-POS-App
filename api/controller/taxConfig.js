const db = require('../../db/models')
const { Op } = require('sequelize')

const taxConfigController = {
  async getAll(req, res) {
    try {
      const store = req.query.store || req.cookies.store || req.user?.store
      const { page = 1, limit = 10, search, status } = req.query

      const where = {}
      if (store) where.store = store
      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }
      if (status !== undefined) {
        where.status = status === 'true'
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [taxes, total] = await Promise.all([
        db.taxConfig.findAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset
        }),
        db.taxConfig.count({ where })
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get tax configs',
        data: taxes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const store = req.query.store || req.cookies.store || req.user?.store

      const tax = await db.taxConfig.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!tax) {
        return res.status(404).json({
          success: false,
          message: 'Tax config not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get tax config',
        data: tax
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { name, rate, type, description } = req.body
      const createdBy = req.user?.id || null

      if (!name || rate === undefined || rate === null) {
        return res.status(400).json({
          success: false,
          message: 'Name and rate are required'
        })
      }

      const tax = await db.taxConfig.create({
        store,
        name,
        rate: parseInt(rate),
        type: type || 'percentage',
        description,
        createdBy
      })

      return res.status(201).json({
        success: true,
        message: 'Success create tax config',
        data: tax
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store
      const { name, rate, type, description, status } = req.body
      const modifiedBy = req.user?.id || null

      const tax = await db.taxConfig.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!tax) {
        return res.status(404).json({
          success: false,
          message: 'Tax config not found'
        })
      }

      await tax.update({
        name: name || tax.name,
        rate: rate !== undefined ? parseInt(rate) : tax.rate,
        type: type || tax.type,
        description: description !== undefined ? description : tax.description,
        status: status !== undefined ? status : tax.status,
        modifiedBy
      })

      return res.status(200).json({
        success: true,
        message: 'Success update tax config',
        data: tax
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store

      const tax = await db.taxConfig.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!tax) {
        return res.status(404).json({
          success: false,
          message: 'Tax config not found'
        })
      }

      await tax.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete tax config'
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

module.exports = taxConfigController
