const express = require('express')
const router = express.Router()
const supplierController = require('../controller/supplier')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get suppliers - All authenticated users
router.get('/', authorization, supplierController.getAll)
router.get('/get-all', authorization, supplierController.getAll)
router.get('/:id', authorization, supplierController.getById)
router.get('/get-by-id/:id', authorization, supplierController.getById)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/',
  requireRole('super_admin', 'admin'),
  supplierController.create
)
router.post(
  '/add',
  requireRole('super_admin', 'admin'),
  supplierController.create
)
router.put(
  '/:id',
  requireRole('super_admin', 'admin'),
  supplierController.update
)
router.put(
  '/edit/:id',
  requireRole('super_admin', 'admin'),
  supplierController.update
)
router.delete(
  '/:id',
  requireRole('super_admin', 'admin'),
  supplierController.delete
)
router.delete(
  '/delete/:id',
  requireRole('super_admin', 'admin'),
  supplierController.delete
)

module.exports = router
