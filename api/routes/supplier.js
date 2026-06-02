const express = require('express')
const router = express.Router()
const multer = require('multer')
const supplierController = require('../controller/supplier')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

const uploadExcel = multer({ storage: multer.memoryStorage() })

// Get suppliers - All authenticated users
router.get('/', authorization, validateStoreAccess, supplierController.getAll)
router.get('/get-all', authorization, validateStoreAccess, supplierController.getAll)
router.get('/:id', authorization, validateStoreAccess, supplierController.getById)
router.get('/get-by-id/:id', authorization, validateStoreAccess, supplierController.getById)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  supplierController.create
)
router.post(
  '/add',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  supplierController.create
)
router.put(
  '/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  supplierController.update
)
router.put(
  '/edit/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  supplierController.update
)
router.delete(
  '/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  supplierController.delete
)
router.delete(
  '/delete/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  supplierController.delete
)

// Download/Upload - Super Admin only
router.get(
  '/template',
  authorization, validateStoreAccess, requireRole('super_admin'),
  supplierController.downloadTemplate
)
router.get(
  '/download',
  authorization, validateStoreAccess, requireRole('super_admin'),
  supplierController.downloadData
)
router.post(
  '/import',
  authorization, validateStoreAccess, requireRole('super_admin'),
  uploadExcel.single('file'),
  supplierController.importData
)

module.exports = router
