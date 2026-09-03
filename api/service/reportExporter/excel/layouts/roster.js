'use strict'
// Roster layout reuses summary layout for simplicity
const summaryLayout = require('./summary')
module.exports = { buildExcelWorkbook: summaryLayout.buildExcelWorkbook }