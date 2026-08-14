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

const addInterval = (date, frequency) => {
  const d = new Date(date)
  if (frequency === 'daily') d.setDate(d.getDate() + 1)
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d
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
              attributes: ['id', 'name', 'icon', 'accountCode']
            },
            {
              model: db.user,
              as: 'creator',
              attributes: ['id', 'fullName']
            },
            {
              model: db.user,
              as: 'employee',
              attributes: ['id', 'fullName']
            },
            {
              model: db.expense,
              as: 'parentExpense',
              attributes: ['id', 'expenseNumber', 'description']
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
            attributes: ['id', 'name', 'icon', 'accountCode']
          },
          {
            model: db.user,
            as: 'creator',
            attributes: ['id', 'fullName']
          },
          {
            model: db.user,
            as: 'employee',
            attributes: ['id', 'fullName']
          },
          {
            model: db.expense,
            as: 'parentExpense',
            attributes: ['id', 'expenseNumber', 'description']
          },
          {
            model: db.expense_payment,
            as: 'payments',
            attributes: [
              'id',
              'expenseId',
              'store',
              'amount',
              'paymentDate',
              'paymentMethod',
              'note',
              'createdBy',
              'createdAt'
            ],
            include: [
              {
                model: db.user,
                as: 'createdByUser',
                attributes: ['id', 'fullName', 'userName']
              }
            ],
            order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']]
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
        payee,
        employeeId,
        receipt,
        frequency,
        recurringEndDate,
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
      const resolvedDate = date || new Date()
      const resolvedFrequency = frequency === 'once' ? null : frequency || null

      const expense = await db.expense.create({
        store: store || null,
        expenseNumber,
        category: resolvedCategory || null,
        description,
        amount: amount ? amount : null,
        date: resolvedDate,
        paymentMethod: paymentMethod || 'cash',
        notes,
        payee: payee || null,
        employeeId: employeeId || null,
        receipt,
        frequency: resolvedFrequency,
        recurringEndDate: recurringEndDate || null,
        nextDueDate: resolvedFrequency
          ? addInterval(new Date(resolvedDate), resolvedFrequency)
          : null,
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
            attributes: ['id', 'name', 'accountCode']
          }
        ]
      })

      if (created.status === 'approved') {
        try {
          const { syncExpenseJournal } = require('../service/accountingService')
          await syncExpenseJournal({
            store: store || created.store,
            expenseId: created.id,
            expenseNumber: created.expenseNumber,
            category:
              created.categoryData?.name ||
              created.category ||
              created.description ||
              null,
            categoryAccountCode: created.categoryData?.accountCode || null,
            amount: created.amount,
            date: created.date || new Date(),
            paymentMethod: created.paymentMethod,
            status: 'approved',
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

  async bulkCreate(req, res) {
    const store = getStore(req)
    const items = req.body.items || []
    const createdBy = req.user?.id || null

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Expense items are required'
      })
    }

    let transaction
    let committed = false
    try {
      transaction = await db.sequelize.transaction()

      const created = []
      for (const item of items) {
        const resolvedCategory = item.categoryId || item.category
        const isDraft = item.status === 'draft'
        if (!isDraft && (!resolvedCategory || !item.amount)) {
          throw new Error('Category and amount are required')
        }

        const resolvedDate = item.date || new Date()
        const resolvedFrequency = item.frequency === 'once' ? null : item.frequency || null

        const expense = await db.expense.create(
          {
            store: store || null,
            expenseNumber: generateExpenseNumber(),
            category: resolvedCategory || null,
            description: item.description,
            amount: item.amount ? item.amount : null,
            date: resolvedDate,
            paymentMethod: item.paymentMethod || 'cash',
            notes: item.notes,
            payee: item.payee || null,
            employeeId: item.employeeId || null,
            receipt: item.receipt,
            frequency: resolvedFrequency,
            recurringEndDate: item.recurringEndDate || null,
            nextDueDate: resolvedFrequency
              ? addInterval(new Date(resolvedDate), resolvedFrequency)
              : null,
            status: item.status || 'pending',
            createdBy
          },
          { transaction }
        )
        created.push(expense)
      }

      await transaction.commit()
      committed = true

      createAudit(
        req,
        'create',
        'expense',
        null,
        `Bulk created ${created.length} expenses`
      )

      const records = await db.expense.findAll({
        where: { id: created.map((e) => e.id) },
        include: [
          {
            model: db.expense_category,
            as: 'categoryData',
            attributes: ['id', 'name', 'accountCode']
          }
        ],
        order: [['id', 'ASC']]
      })

      for (const expense of records) {
        if (expense.status === 'approved') {
          try {
            const { syncExpenseJournal } = require('../service/accountingService')
            await syncExpenseJournal({
              store: store || expense.store,
              expenseId: expense.id,
              expenseNumber: expense.expenseNumber,
              category:
                expense.categoryData?.name ||
                expense.category ||
                expense.description ||
                null,
              categoryAccountCode: expense.categoryData?.accountCode || null,
              amount: expense.amount,
              date: expense.date || new Date(),
              paymentMethod: expense.paymentMethod,
              status: 'approved',
              createdBy: req.user?.id
            })
          } catch (e) {
            console.error('Expense journal posting skipped:', e.message)
          }
        }
      }

      return res.status(201).json({
        success: true,
        message: `Success create ${records.length} expenses`,
        data: records,
        count: records.length
      })
    } catch (error) {
      if (transaction && !committed) {
        try {
          await transaction.rollback()
        } catch (rollbackError) {
          console.error('Bulk create rollback failed:', rollbackError.message)
        }
      }
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
        categoryId,
        category,
        description,
        amount,
        date,
        paymentMethod,
        status,
        notes,
        payee,
        employeeId,
        receipt,
        frequency,
        recurringEndDate
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

      const resolvedCategoryId =
        categoryId !== undefined ? categoryId || null : expense.category

      const resolvedFrequency =
        frequency !== undefined
          ? frequency === 'once'
            ? null
            : frequency || null
          : expense.frequency || null

      let nextDueDate = expense.nextDueDate
      if (frequency !== undefined && frequency !== 'once') {
        nextDueDate = addInterval(
          new Date(date || expense.date),
          frequency
        )
      } else if (frequency === 'once') {
        nextDueDate = null
      } else if (date && resolvedFrequency) {
        nextDueDate = addInterval(new Date(date), resolvedFrequency)
      }

      await expense.update({
        category: resolvedCategoryId,
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
        payee: payee !== undefined ? payee || null : expense.payee,
        employeeId:
          employeeId !== undefined ? employeeId || null : expense.employeeId,
        receipt: receipt !== undefined ? receipt : expense.receipt,
        frequency: resolvedFrequency,
        recurringEndDate:
          recurringEndDate !== undefined
            ? recurringEndDate || null
            : expense.recurringEndDate || null,
        nextDueDate,
        modifiedBy
      })

      try {
        const { syncExpenseJournal } = require('../service/accountingService')
        const categoryRow = expense.category
          ? await db.expense_category.findOne({
              where: { id: expense.category }
            })
          : null
        await syncExpenseJournal({
          store: store || expense.store,
          expenseId: expense.id,
          expenseNumber: expense.expenseNumber,
          category:
            categoryRow?.name || expense.description || expense.expenseNumber || null,
          categoryAccountCode: categoryRow?.accountCode || null,
          amount: expense.amount,
          date: expense.date || new Date(),
          paymentMethod: expense.paymentMethod,
          status: expense.status,
          createdBy: req.user?.id
        })
      } catch (e) {
        console.error('Expense journal sync skipped:', e.message)
      }

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
        const { syncExpenseJournal } = require('../service/accountingService')
        const category = await db.expense_category.findOne({
          where: { id: expense.category || null }
        })
        await syncExpenseJournal({
          store: store || expense.store,
          expenseId: expense.id,
          expenseNumber: expense.expenseNumber,
          category: category?.name || expense.category || expense.description || null,
          categoryAccountCode: category?.accountCode || null,
          amount: expense.amount,
          date: expense.date || new Date(),
          paymentMethod: expense.paymentMethod,
          status: 'approved',
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

      try {
        const { deleteExpenseJournal } = require('../service/accountingService')
        await deleteExpenseJournal({
          store: store || expense.store,
          expenseId: expense.id,
          createdBy: req.user?.id
        })
      } catch (e) {
        console.error('Expense journal removal skipped:', e.message)
      }

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

  async markPaid(req, res) {
    try {
      const { id } = req.params
      const store = getStore(req)
      const { paymentDate, paymentMethod, note } = req.body
      const createdBy = req.user?.id || null

      const where = { id }
      if (store) where.store = store

      const expense = await db.expense.findOne({ where })

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        })
      }

      if (expense.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Rejected expenses cannot be marked as paid'
        })
      }

      await db.expense_payment.create({
        expenseId: expense.id,
        store: store || expense.store,
        amount: expense.amount || 0,
        paymentDate: paymentDate || new Date(),
        paymentMethod: paymentMethod || expense.paymentMethod || 'cash',
        note: note || null,
        createdBy
      })

      let isPaid = true
      let nextDueDate = expense.nextDueDate
      if (expense.frequency) {
        const next = addInterval(
          new Date(expense.nextDueDate || expense.date || new Date()),
          expense.frequency
        )
        if (expense.recurringEndDate && new Date(next) > new Date(expense.recurringEndDate)) {
          nextDueDate = null
        } else {
          nextDueDate = next
          isPaid = false
        }
      }

      await expense.update({
        isPaid,
        nextDueDate,
        paidAt: isPaid ? new Date() : null,
        modifiedBy: createdBy
      })

      createAudit(req, 'update', 'expense', id, `Marked expense as paid: ${id}`)

      return res.status(200).json({
        success: true,
        message: 'Success mark expense as paid',
        data: { id: expense.id, isPaid, nextDueDate }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async markUnpaid(req, res) {
    try {
      const { id } = req.params
      const store = getStore(req)
      const createdBy = req.user?.id || null

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
        isPaid: false,
        paidAt: null,
        modifiedBy: createdBy
      })

      createAudit(req, 'update', 'expense', id, `Marked expense as unpaid: ${id}`)

      return res.status(200).json({
        success: true,
        message: 'Success mark expense as unpaid',
        data: { id: expense.id, isPaid: false }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getUpcomingPayments(req, res) {
    try {
      const store = getStore(req)
      const days = parseInt(req.query.days, 10) || 7

      const now = new Date()
      const horizon = new Date(now.getTime() + days * 86400000)

      const where = {
        status: 'approved',
        isPaid: false,
        frequency: { [Op.not]: null },
        nextDueDate: { [Op.gte]: now, [Op.lte]: horizon }
      }
      if (store) where.store = store

      const rows = await db.expense.findAll({
        where,
        include: [
          {
            model: db.expense_category,
            as: 'categoryData',
            attributes: ['id', 'name']
          },
          {
            model: db.user,
            as: 'employee',
            attributes: ['id', 'fullName']
          }
        ],
        order: [['nextDueDate', 'ASC']],
        limit: 20
      })

      let storeNameMap = {}
      try {
        const locations = await db.location.findAll({
          attributes: ['id', 'name'],
          where: store ? { id: store } : undefined
        })
        storeNameMap = Object.fromEntries(locations.map((l) => [l.id, l.name]))
      } catch (e) {
        storeNameMap = {}
      }

      const data = rows.map((r) => ({
        id: r.id,
        expenseNumber: r.expenseNumber,
        description: r.description,
        amount: r.amount,
        date: r.date,
        nextDueDate: r.nextDueDate,
        frequency: r.frequency,
        paymentMethod: r.paymentMethod,
        payee: r.payee,
        store: r.store,
        storeName: storeNameMap[r.store] || null,
        categoryName: r.categoryData?.name || null,
        employeeName: r.employee?.fullName || null
      }))

      return res.status(200).json({
        success: true,
        message: 'Success get upcoming payments',
        data,
        count: data.length
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

      try {
        const { deleteExpenseJournal } = require('../service/accountingService')
        await deleteExpenseJournal({
          store: store || expense.store,
          expenseId: expense.id,
          createdBy: req.user?.id
        })
      } catch (e) {
        console.error('Expense journal removal skipped:', e.message)
      }

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

      const now = new Date()
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endToday = new Date(startToday.getTime() + 86400000 - 1)

      const startWeek = new Date(startToday)
      startWeek.setDate(startToday.getDate() - ((startToday.getDay() + 6) % 7))
      const endWeek = new Date(startWeek.getTime() + 7 * 86400000 - 1)

      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

      const startYear = new Date(now.getFullYear(), 0, 1)
      const endYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)

      const periodWhere = store ? { store, status: 'approved' } : { status: 'approved' }
      const sumPeriod = async (from, to) => {
        const row = await db.expense.sum('amount', {
          where: { ...periodWhere, date: { [Op.gte]: from, [Op.lte]: to } }
        })
        return row || 0
      }

      const [daily, weekly, monthly, yearly] = await Promise.all([
        sumPeriod(startToday, endToday),
        sumPeriod(startWeek, endWeek),
        sumPeriod(startMonth, endMonth),
        sumPeriod(startYear, endYear)
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get expense summary',
        data: {
          total: totalAmount || 0,
          byCategory,
          byPaymentMethod,
          periods: {
            daily,
            weekly,
            monthly,
            yearly
          }
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

  async generateSalary(req, res) {
    try {
      const store = getStore(req)
      const { month, employeeIds, paymentMethod } = req.body
      const resolvedStore = store || req.body.storeId || req.body.store

      if (!resolvedStore) {
        return res.status(400).json({
          success: false,
          message: 'Store is required'
        })
      }

      const now = new Date()
      let year = now.getFullYear()
      let monthIndex = now.getMonth()
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const parts = month.split('-')
        year = parseInt(parts[0], 10)
        monthIndex = parseInt(parts[1], 10) - 1
      }
      const start = new Date(year, monthIndex, 1)
      const end = new Date(year, monthIndex + 1, 1, 0, 0, -1)
      const monthLabel = `${String(monthIndex + 1).padStart(2, '0')}/${year}`

      let category = await db.expense_category.findOne({
        where: {
          store: resolvedStore,
          [Op.or]: [{ name: { [Op.iLike]: 'gaji' } }, { accountCode: '6100' }]
        }
      })
      if (!category) {
        category = await db.expense_category.create({
          store: resolvedStore,
          name: 'Gaji',
          description: 'Beban gaji karyawan',
          accountCode: '6100',
          status: 'active',
          createdBy: req.user?.id
        })
      }

      const empWhere = {
        userType: 'user',
        status: 'active',
        monthlySalary: { [Op.gt]: 0 },
        store: resolvedStore
      }
      if (employeeIds && employeeIds.length > 0) {
        empWhere.id = employeeIds
      }
      const employees = await db.user.findAll({
        where: empWhere,
        attributes: ['id', 'fullName', 'monthlySalary']
      })

      const { syncExpenseJournal } = require('../service/accountingService')
      let created = 0
      let skipped = 0
      const createdExpenses = []

      for (const emp of employees) {
        const dup = await db.expense.findOne({
          where: {
            store: resolvedStore,
            employeeId: emp.id,
            category: category.id,
            date: { [Op.gte]: start, [Op.lte]: end }
          }
        })
        if (dup) {
          skipped += 1
          continue
        }

        const expense = await db.expense.create({
          store: resolvedStore,
          expenseNumber: generateExpenseNumber(),
          category: category.id,
          description: `Gaji ${emp.fullName}`,
          amount: emp.monthlySalary,
          date: end,
          paymentMethod: paymentMethod || 'cash',
          notes: `Otomatis (penggajian ${monthLabel})`,
          payee: emp.fullName,
          employeeId: emp.id,
          status: 'approved',
          createdBy: req.user?.id
        })

        try {
          await syncExpenseJournal({
            store: resolvedStore,
            expenseId: expense.id,
            expenseNumber: expense.expenseNumber,
            category: category.name,
            categoryAccountCode: category.accountCode || '6100',
            amount: expense.amount,
            date: end,
            paymentMethod: expense.paymentMethod,
            status: 'approved',
            createdBy: req.user?.id
          })
        } catch (e) {
          console.error('Salary journal posting skipped:', e.message)
        }

        created += 1
        createdExpenses.push(expense)
      }

      createAudit(
        req,
        'create',
        'expense',
        null,
        `Generate salary expenses for ${monthLabel} (${created} created, ${skipped} skipped)`
      )

      return res.status(201).json({
        success: true,
        message: `Penggajian ${monthLabel}: ${created} dibuat, ${skipped} dilewati (sudah ada)`,
        data: { created, skipped, categoryId: category.id }
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
