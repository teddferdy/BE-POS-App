const express = require('express')
const router = express.Router()
const reportController = require('../controller/report')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Reports - Admin & Super Admin only
router.get(
  '/sales',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  reportController.getSalesReport
)
router.get(
  '/daily-summary',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  reportController.getDailySummary
)
router.get(
  '/profit-loss',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  reportController.getProfitLoss
)
router.get(
  '/cash-flow',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  reportController.getCashFlow
)
router.get(
  '/sales-report',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  reportController.getSalesReport
)

module.exports = router
