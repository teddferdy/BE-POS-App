const express = require('express')
const router = express.Router()
const multer = require('multer')
const taxConfigController = require('../controller/taxConfig')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createTaxConfigSchema,
  updateTaxConfigSchema
} = require('../validation/schemas')

const uploadExcel = multer({ storage: multer.memoryStorage() })

// Get tax configs - Public (no auth)
router.get('/public', taxConfigController.getPublic)

// Get tax configs - All authenticated users
router.get('/', authorization, validateStoreAccess, taxConfigController.getAll)
router.get(
  '/get-tax-config/:id',
  authorization,
  validateStoreAccess,
  taxConfigController.getById
)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/add-new-tax-config',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createTaxConfigSchema),
  taxConfigController.create
)
router.put(
  '/edit-tax-config/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateTaxConfigSchema),
  taxConfigController.update
)
router.delete(
  '/delete-tax-config/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  taxConfigController.delete
)

// Download/Upload - Super Admin only
router.get(
  '/template',
  authorization,
  validateStoreAccess,
  requireRole('super_admin'),
  taxConfigController.downloadTemplate
)
router.get(
  '/download',
  authorization,
  validateStoreAccess,
  requireRole('super_admin'),
  taxConfigController.downloadData
)
router.post(
  '/import',
  authorization,
  validateStoreAccess,
  requireRole('super_admin'),
  uploadExcel.single('file'),
  taxConfigController.importData
)

// Seed default PPh 2026 data
router.post(
  '/seed',
  authorization,
  validateStoreAccess,
  requireRole('super_admin'),
  taxConfigController.seed
)

module.exports = router
