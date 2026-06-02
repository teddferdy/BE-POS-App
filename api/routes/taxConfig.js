const express = require('express')
const router = express.Router()
const multer = require('multer')
const taxConfigController = require('../controller/taxConfig')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

const uploadExcel = multer({ storage: multer.memoryStorage() })

// Get tax configs - All authenticated users
router.get('/', authorization, validateStoreAccess, taxConfigController.getAll)
router.get('/get-all', authorization, validateStoreAccess, taxConfigController.getAll)
router.get('/get-tax-config/:id', authorization, validateStoreAccess, taxConfigController.getById)
router.get('/:id', authorization, validateStoreAccess, taxConfigController.getById)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  taxConfigController.create
)
router.post(
  '/add-new-tax-config',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  taxConfigController.create
)
router.put(
  '/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  taxConfigController.update
)
router.put(
  '/edit-tax-config/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  taxConfigController.update
)
router.delete(
  '/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  taxConfigController.delete
)
router.delete(
  '/delete-tax-config/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  taxConfigController.delete
)

// Download/Upload - Super Admin only
router.get(
  '/template',
  authorization, validateStoreAccess, requireRole('super_admin'),
  taxConfigController.downloadTemplate
)
router.get(
  '/download',
  authorization, validateStoreAccess, requireRole('super_admin'),
  taxConfigController.downloadData
)
router.post(
  '/import',
  authorization, validateStoreAccess, requireRole('super_admin'),
  uploadExcel.single('file'),
  taxConfigController.importData
)

module.exports = router
