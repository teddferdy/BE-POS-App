const db = require('../../db/models')
const { Op } = require('sequelize')

const expenseCategoryController = {
    async getAll(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { status, search } = req.query

      const where = store ? { store } : {}

      if (status !== undefined) {
        where.status = status === 'true'
      }

      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }

      const categories = await db.expense_category.findAll({
        where,
        order: [['name', 'ASC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get expense categories',
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

    async create(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { name, description, icon } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const category = await db.expense_category.create({
        store,
        name,
        description,
        icon,
        createdBy
      })

      return res.status(201).json({
        success: true,
        message: 'Success create expense category',
        data: category
      })
    } catch (error) {
      console.log(error)
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
      const { name, description, icon, status } = req.body
      const modifiedBy = req.user?.id || null

      const category = await db.expense_category.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Expense category not found'
        })
      }

      await category.update({
        name: name || category.name,
        description: description !== undefined ? description : category.description,
        icon: icon !== undefined ? icon : category.icon,
        status: status !== undefined ? status : category.status,
        modifiedBy
      })

      return res.status(200).json({
        success: true,
        message: 'Success update expense category',
        data: category
      })
    } catch (error) {
      console.log(error)
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

      const category = await db.expense_category.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Expense category not found'
        })
      }

      await category.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete expense category'
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

module.exports = expenseCategoryController