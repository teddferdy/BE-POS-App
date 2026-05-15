const express = require('express')
const router = express.Router()
const reportController = require('../controller/report')
const authorization = require('../../utils/authorization')

router.get('/daily-summary', authorization, reportController.getDailySummary)
router.get('/profit-loss', authorization, reportController.getProfitLoss)
router.get('/cash-flow', authorization, reportController.getCashFlow)
router.get('/sales-report', authorization, reportController.getSalesReport)

module.exports = router