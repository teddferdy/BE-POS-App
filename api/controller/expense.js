const db = require('../../db/models')
const { Op } = require('sequelize')

const generateExpenseNumber = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `EXP-${year}${month}${day}-${random}`
}

const expenseController = {
  async getAll(req, res) {
    try {
      const { store } = req.cookies
      const { category, status, startDate, endDate, paymentMethod, page = 1, limit = 50 } = req.query

      const where = { store }

      if (category) where.category = category
      if (status) where.status = status
      if (paymentMethod) where.paymentMethod = paymentMethod

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = new Date(startDate)
        if (endDate) where.date[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.expense.findAndCountAll({
        where,
        include: [
          {
            model: db.expenseCategory,
            as: 'categoryData',
            attributes: ['id', 'name', 'icon']
          },
          {
            model: db.user,
            as: 'creator',
            attributes: ['id', 'name']
          }
        ],
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      const totalAmount = await db.expense.sum('amount', { where: { store } })

      return res.status(200).json({
        success: true,
        message: 'Success get expenses',
        data: rows,
        summary: {
          total: totalAmount || 0,
          count
        },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
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

  async getById(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const expense = await db.expense.findOne({
        where: { id, store },
        include: [
          {
            model: db.expenseCategory,
            as: 'categoryData',
            attributes: ['id', 'name', 'icon']
          },
          {
            model: db.user,
            as: 'creator',
            attributes: ['id', 'name']
          }
        ]
      })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get expense',
        data: expense
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
      const { store } = req.cookies
      const { category, description, amount, date, paymentMethod, notes, receipt } = req.body
      const createdBy = req.user?.id || null

      if (!category || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Category and amount are required'
        })
      }

      const expenseNumber = generateExpenseNumber()

      const expense = await db.expense.create({
        store,
        expenseNumber,
        category,
        description,
        amount,
        date: date || new Date(),
        paymentMethod: paymentMethod || 'cash',
        notes,
        receipt,
        status: 'approved',
        createdBy
      })

      const created = await db.expense.findOne({
        where: { id: expense.id },
        include: [
          {
            model: db.expenseCategory,
            as: 'categoryData',
            attributes: ['id', 'name']
          }
        ]
      })

      return res.status(201).json({
        success: true,
        message: 'Success create expense',
        data: created
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
      const { store } = req.cookies
      const { category, description, amount, date, paymentMethod, status, notes, receipt } = req.body
      const modifiedBy = req.user?.id || null

      const expense = await db.expense.findOne({
        where: { id, store }
      })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      await expense.update({
        category: category || expense.category,
        description: description !== undefined ? description : expense.description,
        amount: amount !== undefined ? amount : expense.amount,
        date: date || expense.date,
        paymentMethod: paymentMethod || expense.paymentMethod,
        status: status || expense.status,
        notes: notes !== undefined ? notes : expense.notes,
        receipt: receipt !== undefined ? receipt : expense.receipt,
        modifiedBy
      })

      return res.status(200).json({
        success: true,
        message: 'Success update expense',
        data: expense
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async approve(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const expense = await db.expense.findOne({
        where: { id, store }
      })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      await expense.update({ status: 'approved' })

      return res.status(200).json({
        success: true,
        message: 'Success approve expense'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async reject(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const expense = await db.expense.findOne({
        where: { id, store }
      })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      await expense.update({ status: 'rejected' })

      return res.status(200).json({
        success: true,
        message: 'Success reject expense'
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
      const { store } = req.cookies

      const expense = await db.expense.findOne({
        where: { id, store }
      })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      await expense.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete expense'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getSummary(req, res) {
    try {
      const { store } = req.cookies
      const { startDate, endDate } = req.query

      const where = { store, status: 'approved' }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = new Date(startDate)
        if (endDate) where.date[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const totalAmount = await db.expense.sum('amount', { where })

      const byCategory = await db.expense.findAll({
        where,
        attributes: [
          'category',
          [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total']
        ],
        include: [
          {
            model: db.expenseCategory,
            as: 'categoryData',
            attributes: ['id', 'name', 'icon']
          }
        ],
        group: ['category', 'categoryData.id', 'categoryData.name', 'categoryData.icon'],
        raw: false
      })

      const byPaymentMethod = await db.expense.findAll({
        where,
        attributes: [
          'paymentMethod',
          [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total']
        ],
        group: ['paymentMethod'],
        raw: false
      })

      return res.status(200).json({
        success: true,
        message: 'Success get expense summary',
        data: {
          total: totalAmount || 0,
          byCategory,
          byPaymentMethod
        }
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

module.exports = expenseController