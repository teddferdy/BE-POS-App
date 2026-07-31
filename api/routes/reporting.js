const express = require('express')
const router = express.Router()
const reportingController = require('../controller/reporting')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Sales Summary Report
router.get(
  '/sales-summary',
  authorization,
  validateStoreAccess,
  reportingController.getSalesSummary
)

// Product Sales Report
router.get(
  '/product-sales',
  authorization,
  validateStoreAccess,
  reportingController.getProductSalesSummary
)

// Category Sales Report
router.get(
  '/category-sales',
  authorization,
  validateStoreAccess,
  reportingController.getCategorySalesSummary
)

// Kasir Performance Report
router.get(
  '/kasir-performance',
  authorization,
  validateStoreAccess,
  reportingController.getKasirPerformance
)

module.exports = router
