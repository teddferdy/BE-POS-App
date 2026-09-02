'use strict'
const ExcelJS = require('exceljs')
const { formatValue } = require('./formatters')

const buildExcelWorkbook = async (spec) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Laporan')
  const accent = spec.accentColor || '#0f172a'

  let rowIndex = 1

  if (spec.brand?.name) {
    const brand = spec.brand
    ws.mergeCells(rowIndex, 1, rowIndex, spec.columns.length)
    ws.getCell(rowIndex, 1).value = brand.name
    ws.getCell(rowIndex, 1).font = { bold: true, size: 14 }
    rowIndex++
    const lines = []
    if (brand.address) lines.push(brand.address)
    const cityLine = [brand.city, brand.province, brand.postalCode].filter(Boolean).join(', ')
    if (cityLine) lines.push(cityLine)
    if (brand.phoneNumber) lines.push(`Telp: ${brand.phoneNumber}`)
    if (brand.email) lines.push(brand.email)
    if (lines.length) {
      ws.mergeCells(rowIndex, 1, rowIndex, spec.columns.length)
      ws.getCell(rowIndex, 1).value = lines.join('\n')
      ws.getCell(rowIndex, 1).font = { size: 9, color: { argb: 'FF64748B' } }
      ws.getCell(rowIndex, 1).alignment = { wrapText: true, vertical: 'top' }
      rowIndex++
    }
    rowIndex++
  }

  ws.mergeCells(rowIndex, 1, rowIndex, spec.columns.length)
  ws.getCell(rowIndex, 1).value = spec.title || ''
  ws.getCell(rowIndex, 1).font = { bold: true, size: 12 }
  rowIndex++
  if (spec.subtitle) {
    ws.mergeCells(rowIndex, 1, rowIndex, spec.columns.length)
    ws.getCell(rowIndex, 1).value = spec.subtitle
    ws.getCell(rowIndex, 1).font = { size: 9, color: { argb: 'FF64748B' } }
    rowIndex++
  }
  rowIndex++

  spec.columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width || 16
  })

  const headerRow = ws.getRow(rowIndex)
  spec.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.label
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: accent.replace('#', 'FF').toUpperCase() }
    }
    cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' }
  })
  headerRow.height = 22
  rowIndex++

  const zebraColor = 'FFF1F5F9'
  for (const row of spec.rows || []) {
    const excelRow = ws.getRow(rowIndex)
    spec.columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1)
      cell.value = formatValue(row[col.key], col.type)
      cell.alignment = { horizontal: col.align || 'left' }
      if (rowIndex % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: zebraColor }
        }
      }
    })
    rowIndex++
  }

  if (spec.totals && spec.totals.length > 0 && spec.rows && spec.rows.length > 0) {
    const acc = {}
    for (const row of spec.rows) {
      for (const key of spec.totals) acc[key] = (acc[key] || 0) + Number(row[key] || 0)
    }
    const totalRow = ws.getRow(rowIndex)
    spec.columns.forEach((col, i) => {
      const cell = totalRow.getCell(i + 1)
      if (col.key && spec.totals.includes(col.key)) {
        cell.value = formatValue(acc[col.key], col.type)
      } else if (i === 0) {
        cell.value = 'Total'
      } else {
        cell.value = ''
      }
      cell.font = { bold: true }
      cell.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }
    })
    rowIndex++
  }

  rowIndex++
  ws.mergeCells(rowIndex, 1, rowIndex, spec.columns.length)
  ws.getCell(rowIndex, 1).value = `Dicetak: ${new Date().toLocaleString('id-ID')}`
  ws.getCell(rowIndex, 1).font = { size: 8, color: { argb: 'FF94A3B8' } }

  ws.views = [{ state: 'frozen', ySplit: headerRow.number, xSplit: 0 }]
  return wb
}

module.exports = { buildExcelWorkbook }
