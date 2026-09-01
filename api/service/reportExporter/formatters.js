'use strict'

const formatNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('id-ID') : '0'
}

const formatCurrency = (value) => {
  const n = Number(value)
  const formatted = Number.isFinite(n) ? n.toLocaleString('id-ID') : '0'
  return `Rp ${formatted}`
}

const formatPercent = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0%'
  // Accept both fraction (0.34) and whole-number percent (34).
  const pct = Math.abs(n) <= 1 ? Math.round(n * 100) : Math.round(n)
  return `${pct}%`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTHS[d.getMonth()]
  return `${day} ${month} ${d.getFullYear()}`
}

const formatValue = (value, type) => {
  if (value === null || value === undefined) return ''
  switch (type) {
    case 'number':
      return formatNumber(value)
    case 'currency':
      return formatCurrency(value)
    case 'percent':
      return formatPercent(value)
    case 'date':
      return formatDate(value)
    default:
      return String(value)
  }
}

module.exports = { formatValue, formatCurrency, formatNumber, formatPercent, formatDate }
