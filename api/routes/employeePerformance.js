const express = require('express')
const router = express.Router()
const employeePerformanceController = require('../controller/employeePerformance')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get(
  '/performance',
  authorization,
  validateStoreAccess,
  employeePerformanceController.getPerformance
)

router.get(
  '/:id/performance',
  authorization,
  validateStoreAccess,
  employeePerformanceController.getEmployeePerformance
)

router.get(
  '/top-performers',
  authorization,
  validateStoreAccess,
  employeePerformanceController.getTopPerformers
)

module.exports = router
