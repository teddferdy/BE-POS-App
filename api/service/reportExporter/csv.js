'use strict'
const { formatValue } = require('./formatters')

const escapeField = (value) => {
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const renderCsv = ({ columns, rows, totals }) => {
  const lines = []

  const header = columns.map((c) => escapeField(c.label)).join(',')
  lines.push(header)

  for (const row of rows || []) {
    const cells = columns.map((c) =>
      escapeField(formatValue(row[c.key], c.type))
    )
    lines.push(cells.join(','))
  }

  if (totals && totals.length > 0) {
    const rowAcc = {}
    for (const row of rows || []) {
      for (const key of totals) {
        rowAcc[key] = (rowAcc[key] || 0) + Number(row[key] || 0)
      }
    }
    const cells = columns.map((c) => {
      if (totals.includes(c.key)) {
        return escapeField(formatValue(rowAcc[c.key], c.type))
      }
      return columns.indexOf(c) === 0 ? 'Total' : ''
    })
    lines.push(cells.join(','))
  }

  // \uFEFF = UTF-8 BOM so Excel opens it correctly.
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

module.exports = { renderCsv }
