const express = require('express')
const router = express.Router()

const besSellingController = require('../controller/best-selling')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Best selling data - Admin & Super Admin only (report data)
router.get(
  '/get-best-selling',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  besSellingController.getAllBestSelling
)
router.get(
  '/get-chart-by-year',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  besSellingController.chartDataByYear
)
router.get(
  '/get-chart-by-month',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  besSellingController.chartDataByMonth
)
router.get(
  '/get-chart-current-and-two-days-before',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  besSellingController.chartDataByCurrentDateAndTwoDaysBefore
)
router.get(
  '/get-chart-current-and-seven-days-before',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  besSellingController.chartDataByCurrentDateAndSevenDaysBefore
)
router.get(
  '/get-earning-today',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  besSellingController.getEarningToday
)

module.exports = router
