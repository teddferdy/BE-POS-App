'use strict'
const express = require('express')
const router = express.Router()
const reportController = require('../controller/report')

router.get('/daily', reportController.getDailyReport)
router.get('/profit-loss', reportController.getProfitLoss)
router.get('/cash-flow', reportController.getCashFlow)

module.exports = router
