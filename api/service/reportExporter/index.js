'use strict'
const { buildExcelWorkbook } = require('./excel')
const { renderPdf } = require('./pdf')
const { renderCsv } = require('./csv')

const FORMATS = {
  excel: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx' },
  pdf: { mime: 'application/pdf', ext: '.pdf' },
  csv: { mime: 'text/csv; charset=utf-8', ext: '.csv' }
}

const getContentType = (format) => FORMATS[format]?.mime
const getExtension = (format) => FORMATS[format]?.ext

const exportReport = async ({ format, spec, filename, res }) => {
  if (!FORMATS[format]) throw new Error(`Format tidak didukung: ${format}`)

  const fullName = filename.endsWith(getExtension(format))
    ? filename
    : `${filename}${getExtension(format)}`

  res.setHeader('Content-Type', getContentType(format))
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(fullName)}"`
  )

  if (format === 'excel') {
    const wb = await buildExcelWorkbook(spec)
    await wb.xlsx.write(res)
    res.end()
    return
  }
  if (format === 'pdf') {
    await renderPdf(spec, res)
    return
  }
  // csv
  res.end(renderCsv(spec))
}

module.exports = { exportReport, getContentType, getExtension }
