const express = require('express')
const router = express.Router()
const multer = require('multer')
const supplierController = require('../controller/supplier')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const { createSupplierSchema, updateSupplierSchema } = require('../validation/schemas')

const uploadExcel = multer({ storage: multer.memoryStorage() })

// Get suppliers - All authenticated users
router.get('/', authorization, validateStoreAccess, supplierController.getAll)
router.get(
  '/detail/:id',
  authorization,
  validateStoreAccess,
  supplierController.getDetail
)
router.get(
  '/:id',
  authorization,
  validateStoreAccess,
  supplierController.getById
)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createSupplierSchema),
  supplierController.create
)
router.put(
  '/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateSupplierSchema),
  supplierController.update
)
router.delete(
  '/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  supplierController.delete
)

// Download/Upload - Super Admin only
router.get(
  '/template',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  supplierController.downloadTemplate
)
router.get(
  '/download',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  supplierController.downloadData
)
router.post(
  '/import',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  uploadExcel.single('file'),
  supplierController.importData
)

module.exports = router
