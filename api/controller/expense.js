const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const getStore = (req) => {
  if (req.user?.roleType === 'super_admin') return req.storeId || null
  return (
    req.storeId ||
    req.body.storeId ||
    req.body.store ||
    req.query.store ||
    req.cookies.store ||
    req.cookies.activeStore ||
    req.user?.store
  )
}

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
      const store = getStore(req)
      const {
        category,
        status,
        startDate,
        endDate,
        paymentMethod,
        page = 1,
        limit = 10,
        search
      } = req.query

      const where = store ? { store } : {}
      const statsWhere = store ? { store } : {}

      if (category) where.category = category
      if (status) where.status = status
      if (paymentMethod) where.paymentMethod = paymentMethod

      if (search) {
        where[Op.or] = [
          { description: { [Op.iLike]: `%${search}%` } },
          { '$categoryData.name$': { [Op.iLike]: `%${search}%` } }
        ]
      }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = new Date(startDate)
        if (endDate) where.date[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [
        rows,
        count,
        draftCount,
        pendingCount,
        approvedCount,
        rejectedCount
      ] = await Promise.all([
        db.expense.findAll({
          where,
          include: [
            {
              model: db.expense_category,
              as: 'categoryData',
              attributes: ['id', 'name', 'icon']
            },
            {
              model: db.user,
              as: 'creator',
              attributes: ['id', 'fullName']
            }
          ],
          order: [
            ['date', 'DESC'],
            ['createdAt', 'DESC']
          ],
          limit: parseInt(limit),
          offset
        }),
        db.expense.count({ where }),
        db.expense.count({ where: { ...statsWhere, status: 'draft' } }),
        db.expense.count({ where: { ...statsWhere, status: 'pending' } }),
        db.expense.count({ where: { ...statsWhere, status: 'approved' } }),
        db.expense.count({ where: { ...statsWhere, status: 'rejected' } })
      ])

      const totalAmount = await db.expense.sum('amount', {
        where: { ...statsWhere, status: 'approved' }
      })

      return res.status(200).json({
        success: true,
        message: 'Success get expenses',
        data: rows,
        summary: {
          total: totalAmount || 0,
          count
        },
        stats: {
          draft: draftCount,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount
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
      const store = getStore(req)

      const where = { id }
      if (store) where.store = store

      const expense = await db.expense.findOne({
        where,
        include: [
          {
            model: db.expense_category,
            as: 'categoryData',
            attributes: ['id', 'name', 'icon']
          },
          {
            model: db.user,
            as: 'creator',
            attributes: ['id', 'fullName']
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
      const store = getStore(req)
      const {
        categoryId,
        category,
        description,
        amount,
        date,
        paymentMethod,
        notes,
        receipt,
        status
      } = req.body
      const createdBy = req.user?.id || null
      const resolvedCategory = categoryId || category

      const isDraft = status === 'draft'
      if (!isDraft && (!resolvedCategory || !amount)) {
        return res.status(400).json({
          success: false,
          message: 'Category and amount are required'
        })
      }

      const expenseNumber = generateExpenseNumber()

      const expense = await db.expense.create({
        store: store || null,
        expenseNumber,
        category: resolvedCategory || null,
        description,
        amount: amount ? amount : null,
        date: date || new Date(),
        paymentMethod: paymentMethod || 'cash',
        notes,
        receipt,
        status: status || 'pending',
        createdBy
      })

      createAudit(
        req,
        'create',
        'expense',
        expense.id,
        `Created expense: ${expense.id}`
      )

      const created = await db.expense.findOne({
        where: { id: expense.id },
        include: [
          {
            model: db.expense_category,
            as: 'categoryData',
            attributes: ['id', 'name']
          }
        ]
      })

      if (created.status !== 'pending' && created.status !== 'draft') {
        try {
          const { postExpenseJournal } = require('../service/accountingService')
          await postExpenseJournal({
            store: store || created.store,
            expenseId: created.id,
            expenseNumber: created.expenseNumber,
            category:
              created.categoryData?.name ||
              created.category ||
              created.description ||
              null,
            amount: created.amount,
            date: created.date || new Date(),
            paymentMethod: created.paymentMethod,
            createdBy: req.user?.id
          })
        } catch (e) {
          console.error('Expense journal posting skipped:', e.message)
        }
      }

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
      const store = getStore(req)
      const {
        category,
        description,
        amount,
        date,
        paymentMethod,
        status,
        notes,
        receipt
      } = req.body
      const modifiedBy = req.user?.id || null

      const where = { id }
      if (store) where.store = store

      const expense = await db.expense.findOne({ where })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      await expense.update({
        category: category || expense.category,
        description:
          description !== undefined ? description : expense.description,
        amount:
          amount !== undefined
            ? amount || amount === 0
              ? amount
              : null
            : expense.amount,
        date: date || expense.date,
        paymentMethod: paymentMethod || expense.paymentMethod,
        status: status || expense.status,
        notes: notes !== undefined ? notes : expense.notes,
        receipt: receipt !== undefined ? receipt : expense.receipt,
        modifiedBy
      })

      createAudit(req, 'update', 'expense', id, `Updated expense: ${id}`)

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
      const store = getStore(req)

      const where = { id }
      if (store) where.store = store

      const expense = await db.expense.findOne({ where })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      if (expense.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending expenses can be approved'
        })
      }

      await expense.update({ status: 'approved' })

      try {
        const { postExpenseJournal } = require('../service/accountingService')
        const category = await db.expense_category.findOne({
          where: { id: expense.category || null }
        })
        await postExpenseJournal({
          store: store || expense.store,
          expenseId: expense.id,
          expenseNumber: expense.expenseNumber,
          category: category?.name || expense.category || expense.description || null,
          amount: expense.amount,
          date: expense.date || new Date(),
          paymentMethod: expense.paymentMethod,
          createdBy: req.user?.id
        })
      } catch (e) {
        console.error('Expense journal posting skipped:', e.message)
      }

      createAudit(req, 'approve', 'expense', id, `Approved expense: ${id}`)

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
      const store = getStore(req)

      const where = { id }
      if (store) where.store = store

      const expense = await db.expense.findOne({ where })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      if (expense.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending expenses can be rejected'
        })
      }

      await expense.update({ status: 'rejected' })

      createAudit(req, 'reject', 'expense', id, `Rejected expense: ${id}`)

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
      const store = getStore(req)

      const where = { id }
      if (store) where.store = store

      const expense = await db.expense.findOne({ where })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      await expense.destroy()

      createAudit(req, 'delete', 'expense', id, `Deleted expense: ${id}`)

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
      const store = getStore(req)
      const { startDate, endDate } = req.query

      const where = store
        ? { store, status: 'approved' }
        : { status: 'approved' }

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
            model: db.expense_category,
            as: 'categoryData',
            attributes: ['id', 'name', 'icon']
          }
        ],
        group: [
          'category',
          'categoryData.id',
          'categoryData.name',
          'categoryData.icon'
        ],
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
