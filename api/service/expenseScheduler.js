'use strict'
const db = require('../../db/models')
const { Op } = require('sequelize')

let timer = null
let running = false

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

const MAX_GENERATIONS_PER_TEMPLATE = 30

async function generateDueRecurringExpenses() {
  const now = new Date()

  const templates = await db.expense.findAll({
    where: {
      frequency: { [Op.not]: null },
      nextDueDate: { [Op.lte]: now },
      status: 'approved'
    }
  })

  for (const tpl of templates) {
    let guard = 0
    let generated = 0

    while (
      tpl.nextDueDate &&
      new Date(tpl.nextDueDate) <= now &&
      guard < MAX_GENERATIONS_PER_TEMPLATE
    ) {
      guard += 1
      const due = new Date(tpl.nextDueDate)

      const child = await db.expense.create({
        store: tpl.store,
        expenseNumber: generateExpenseNumber(),
        category: tpl.category,
        description: tpl.description,
        amount: tpl.amount,
        date: due,
        paymentMethod: tpl.paymentMethod,
        notes: tpl.notes
          ? `${tpl.notes}\nOtomatis (berulang)`
          : 'Otomatis (berulang)',
        payee: tpl.payee,
        employeeId: tpl.employeeId,
        status: 'approved',
        frequency: null,
        parentId: tpl.id,
        nextDueDate: null,
        recurringEndDate: null,
        createdBy: null
      })

      try {
        const { postExpenseJournal } = require('../service/accountingService')
        const category = await db.expense_category.findOne({
          where: { id: tpl.category || null }
        })
        await postExpenseJournal({
          store: tpl.store,
          expenseId: child.id,
          expenseNumber: child.expenseNumber,
          category:
            category?.name || tpl.description || child.expenseNumber || null,
          categoryAccountCode: category?.accountCode || null,
          amount: child.amount,
          date: due,
          paymentMethod: child.paymentMethod,
          createdBy: null
        })
      } catch (e) {
        console.error('Recurring expense journal skipped:', e.message)
      }

      tpl.nextDueDate = addInterval(due, tpl.frequency)
      generated += 1
    }

    if (
      tpl.recurringEndDate &&
      tpl.nextDueDate &&
      new Date(tpl.nextDueDate) > new Date(tpl.recurringEndDate)
    ) {
      tpl.nextDueDate = null
    }

    if (generated > 0) {
      await tpl.save()
      console.log(
        `Recurring expense ${tpl.expenseNumber}: generated ${generated} expense(s)`
      )
    }
  }
}

const startExpenseScheduler = (intervalMs = 60000) => {
  if (timer) return
  timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await generateDueRecurringExpenses()
    } catch (err) {
      console.error('Expense scheduler tick error:', err)
    } finally {
      running = false
    }
  }, intervalMs)
  if (timer.unref) timer.unref()
  console.log(`Expense scheduler started (every ${intervalMs}ms)`)
}

const stopExpenseScheduler = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { startExpenseScheduler, stopExpenseScheduler }
