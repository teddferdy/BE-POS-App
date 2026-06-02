const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const priceListTemplateController = {
  async getAll(req, res) {
    try {
      const store = req.query.store || req.cookies.store || req.user?.store
      const { page = 1, limit = 10, search } = req.query

      const where = {}
      if (store) where.store = store
      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [templates, total] = await Promise.all([
        db.priceListTemplate.findAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset
        }),
        db.priceListTemplate.count({ where })
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get price list templates',
        data: templates,
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

      const template = await db.priceListTemplate.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Price list template not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get price list template',
        data: template
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
      const { name, description, isActive, tiers } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      let parsedTiers = []
      if (tiers) {
        try {
          parsedTiers = typeof tiers === 'string' ? JSON.parse(tiers) : tiers
        } catch (e) {
          parsedTiers = []
        }
      }

      const template = await db.priceListTemplate.create({
        store,
        name,
        description,
        isActive: isActive !== undefined ? isActive : true,
        tiers: parsedTiers,
        createdBy
      })

      await createAudit(req, 'create', 'price_list_template', template.id, 'Created price_list_template: ' + template.id)

      return res.status(201).json({
        success: true,
        message: 'Success create price list template',
        data: template
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
      const { name, description, isActive, tiers } = req.body
      const modifiedBy = req.user?.id || null

      const template = await db.priceListTemplate.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Price list template not found'
        })
      }

      const updateData = {
        name: name || template.name,
        description: description !== undefined ? description : template.description,
        isActive: isActive !== undefined ? isActive : template.isActive,
        modifiedBy
      }

      if (tiers !== undefined) {
        try {
          updateData.tiers = typeof tiers === 'string' ? JSON.parse(tiers) : tiers
        } catch (e) {
          updateData.tiers = template.tiers
        }
      }

      await template.update(updateData)

      await createAudit(req, 'update', 'price_list_template', id, 'Updated price_list_template: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success update price list template',
        data: template
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

      const template = await db.priceListTemplate.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Price list template not found'
        })
      }

      await template.destroy()

      await createAudit(req, 'delete', 'price_list_template', id, 'Deleted price_list_template: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success delete price list template'
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

module.exports = priceListTemplateController
