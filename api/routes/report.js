'use strict'
const express = require('express')
const router = express.Router()
const reportController = require('../controller/report')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/daily', authorization, validateStoreAccess, reportController.getDailyReport)
router.get('/profit-loss', authorization, validateStoreAccess, reportController.getProfitLoss)
router.get('/cash-flow', authorization, validateStoreAccess, reportController.getCashFlow)

module.exports = router
