const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const ingredientCategoryController = {
  async getAll(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { search, status } = req.query

      const where = store ? { store } : {}
      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }
      if (status === 'active' || status === 'inactive') {
        where.status = status
      }

      const categories = await db.ingredientCategory.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient categories',
        data: categories
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
      const store = req.cookies.store || req.user?.store

      const category = await db.ingredientCategory.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient category',
        data: category
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
      const store = req.body.store || req.cookies.store || req.user?.store
      const { name, status } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const existing = await db.ingredientCategory.findOne({
        where: { name, store }
      })
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Kategori sudah terdaftar'
        })
      }

      const category = await db.ingredientCategory.create({
        store,
        name,
        status: status === true || status === 'active' ? 'active' : status === false || status === 'inactive' ? 'inactive' : 'active',
        createdBy
      })

      createAudit(req, 'create', 'ingredientCategory', category.id, 'Created ingredient category: ' + name)

      return res.status(201).json({
        success: true,
        message: 'Success create ingredient category',
        data: category
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
      const store = req.body.store || req.cookies.store || req.user?.store
      const { name, status } = req.body
      const modifiedBy = req.user?.id || null

      const category = await db.ingredientCategory.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      if (name && name !== category.name) {
        const existing = await db.ingredientCategory.findOne({
          where: { name, store, id: { [Op.ne]: id } }
        })
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Kategori sudah terdaftar'
          })
        }
      }

      await category.update({
        name: name || category.name,
        status: status !== undefined
          ? status === true
            ? 'active'
            : status === false
              ? 'inactive'
              : status
          : category.status,
        store: store || category.store,
        modifiedBy
      })

      createAudit(req, 'update', 'ingredientCategory', id, 'Updated ingredient category: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success update ingredient category',
        data: category
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

      const category = await db.ingredientCategory.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient category not found'
        })
      }

      await category.destroy()
      createAudit(req, 'delete', 'ingredientCategory', id, 'Deleted ingredient category: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success delete ingredient category'
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

module.exports = ingredientCategoryController
