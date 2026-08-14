'use strict'
const crypto = require('crypto')

const generateExpenseNumber = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = crypto.randomInt(0, 10000).toString().padStart(4, '0')
  return `EXP-${year}${month}${day}-${random}`
}

const addInterval = (date, frequency) => {
  const d = new Date(date)
  if (frequency === 'daily') d.setDate(d.getDate() + 1)
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') {
    const day = d.getDate()
    const lastDayCurrent = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const safeDay = Math.min(day, lastDayCurrent)
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    const lastDayTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(safeDay, lastDayTarget))
  } else if (frequency === 'yearly') {
    const day = d.getDate()
    const month = d.getMonth()
    d.setFullYear(d.getFullYear() + 1)
    if (d.getMonth() !== month || d.getDate() !== day) d.setDate(0)
  }
  return d
}

module.exports = { generateExpenseNumber, addInterval }
