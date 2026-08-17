const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const expenseCategoryController = {
  async getAll(req, res) {
    try {
      const { status, search, store: queryStore } = req.query
      let store =
        queryStore || req.storeId || req.cookies.store || req.user?.store
      if (req.user?.roleType !== 'super_admin') {
        store = req.user?.store
      }

      const where = store ? { store } : {}

      if (status === 'active' || status === 'true') {
        where.status = 'active'
      } else if (status === 'inactive' || status === 'false') {
        where.status = 'inactive'
      }

      if (search) {
        where.name = { [Op.iLike]: `%${search}%` }
      }

      const categories = await db.expense_category.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })

      const storeWhere = store ? { store } : {}
      const [active, draft, inactive] = await Promise.all([
        db.expense_category.count({
          where: { ...storeWhere, status: 'active' }
        }),
        db.expense_category.count({
          where: { ...storeWhere, status: 'draft' }
        }),
        db.expense_category.count({
          where: { ...storeWhere, status: 'inactive' }
        })
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get expense categories',
        data: categories,
        stats: { total: active + draft + inactive, active, draft, inactive }
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
      const store = req.storeId || req.cookies.store || req.user?.store
      const { name, description, icon, accountCode, status } = req.body
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
        accountCode: accountCode || null,
        status,
        createdBy
      })

      createAudit(
        req,
        'create',
        'expense_category',
        category.id,
        `Created expense category: ${category.id}`
      )

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
      const store = req.storeId || req.cookies.store || req.user?.store
      const { name, description, icon, accountCode, status } = req.body
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
        description:
          description !== undefined ? description : category.description,
        icon: icon !== undefined ? icon : category.icon,
        accountCode:
          accountCode !== undefined
            ? accountCode || null
            : category.accountCode,
        status:
          status !== undefined
            ? status === true
              ? 'active'
              : status === false
                ? 'inactive'
                : status
            : category.status,
        modifiedBy
      })

      createAudit(
        req,
        'update',
        'expense_category',
        id,
        `Updated expense category: ${id}`
      )

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
      const store = req.storeId || req.cookies.store || req.user?.store

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

      createAudit(
        req,
        'delete',
        'expense_category',
        id,
        `Deleted expense category: ${id}`
      )

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
