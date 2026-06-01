const express = require('express')
const router = express.Router()
const taxConfigController = require('../controller/taxConfig')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get tax configs - All authenticated users
router.get('/', authorization, taxConfigController.getAll)
router.get('/get-all', authorization, taxConfigController.getAll)
router.get('/get-tax-config/:id', authorization, taxConfigController.getById)
router.get('/:id', authorization, taxConfigController.getById)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/',
  requireRole('super_admin', 'admin'),
  taxConfigController.create
)
router.post(
  '/add-new-tax-config',
  requireRole('super_admin', 'admin'),
  taxConfigController.create
)
router.put(
  '/:id',
  requireRole('super_admin', 'admin'),
  taxConfigController.update
)
router.put(
  '/edit-tax-config/:id',
  requireRole('super_admin', 'admin'),
  taxConfigController.update
)
router.delete(
  '/:id',
  requireRole('super_admin', 'admin'),
  taxConfigController.delete
)
router.delete(
  '/delete-tax-config/:id',
  requireRole('super_admin', 'admin'),
  taxConfigController.delete
)

module.exports = router
