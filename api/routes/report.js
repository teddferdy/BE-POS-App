const express = require('express')
const router = express.Router()
const reportController = require('../controller/report')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Reports - Admin & Super Admin only
router.get(
  '/daily-summary',
  requireRole('super_admin', 'admin'),
  reportController.getDailySummary
)
router.get(
  '/profit-loss',
  requireRole('super_admin', 'admin'),
  reportController.getProfitLoss
)
router.get(
  '/cash-flow',
  requireRole('super_admin', 'admin'),
  reportController.getCashFlow
)
router.get(
  '/sales-report',
  requireRole('super_admin', 'admin'),
  reportController.getSalesReport
)

module.exports = router
