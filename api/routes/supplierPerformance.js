const express = require('express')
const router = express.Router()
const supplierPerformanceController = require('../controller/supplierPerformance')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  calculateSupplierScoreSchema,
  updateSupplierScoreNoteSchema
} = require('../validation/schemas')

// ─── Supplier Performance ─────────────────────────────────────────

router.get(
  '/scores',
  authorization,
  validateStoreAccess,
  supplierPerformanceController.getSupplierScores
)

router.get(
  '/scores/top',
  authorization,
  validateStoreAccess,
  supplierPerformanceController.getTopSuppliers
)

router.get(
  '/scores/:id',
  authorization,
  validateStoreAccess,
  supplierPerformanceController.getSupplierScoreById
)

router.get(
  '/performance/:supplierId',
  authorization,
  validateStoreAccess,
  supplierPerformanceController.getSupplierPerformanceSummary
)

router.post(
  '/scores/calculate',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(calculateSupplierScoreSchema),
  supplierPerformanceController.calculateSupplierScore
)

router.put(
  '/scores/:id/notes',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateSupplierScoreNoteSchema),
  supplierPerformanceController.updateSupplierScoreNote
)

module.exports = router
