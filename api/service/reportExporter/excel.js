'use strict'
const ExcelJS = require('exceljs')

const layoutModules = {
  summary: require('./excel/layouts/summary'),
  ranking: require('./excel/layouts/ranking'),
  statement: require('./excel/layouts/statement'),
  roster: require('./excel/layouts/roster')
}

/**
 * Build Excel workbook with layout based on spec.archetype
 * @param {Object} spec - report specification
 * @returns {Promise<ExcelJS.Workbook>}
 */
const buildExcelWorkbook = async (spec) => {
  const archetype = spec.archetype || 'summary'
  const layout = layoutModules[archetype] || layoutModules.summary
  return layout.buildExcelWorkbook(spec)
}

module.exports = { buildExcelWorkbook }