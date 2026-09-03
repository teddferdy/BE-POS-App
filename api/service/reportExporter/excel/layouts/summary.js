'use strict'
const ExcelJS = require('exceljs')
const style = require('../style')
const { formatValue } = require('../../formatters')

const buildExcelWorkbook = async (spec) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Laporan')
  const colCount = spec.columns.length

  let rowIndex = 1

  // Brand header (logo, name, address, phone, email)
  rowIndex = style.addBrandHeader(ws, spec, rowIndex)

  // Title block
  rowIndex = style.addTitleBlock(ws, spec, rowIndex)

  // Info block (generation date)
  rowIndex = style.addInfoBlock(ws, spec, rowIndex)

  // Table (header + data + zebra)
  const tableEndRow = style.addTable(ws, spec, rowIndex)
  rowIndex = tableEndRow

  // Totals row (if applicable)
  rowIndex = style.addTotalsRow(ws, spec, rowIndex)

  // Signature block
  rowIndex = style.addSignatureBlock(ws, spec, rowIndex)

  // Footer
  rowIndex = style.addFooter(ws, spec, rowIndex)

  // Freeze header row (table header row is after title+info blocks)
  // Compute dynamically:
  let brandRows = 0
  if (spec.brand?.name) {
    brandRows = 2 // name line + address block (even if empty, we added a blank after name?)
  }
  const titleRows = spec.title ? (spec.subtitle ? 2 : 1) : 0
  const infoRows = 1 // info block always adds generation date row
  const tableStartRow = 1 + brandRows + titleRows + infoRows
  ws.views = [{ state: 'frozen', ySplit: tableStartRow, xSplit: 0 }]

  return wb
}

module.exports = { buildExcelWorkbook }