const express = require('express')
const router = express.Router()
const purchaseOrderController = require('../controller/purchaseOrder')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get PO - All authenticated users
router.get('/get-all', authorization, purchaseOrderController.getAll)
router.get('/get-by-id/:id', authorization, purchaseOrderController.getById)

// Create/Update/Delete - Admin & Super Admin only
router.post(
  '/create',
  requireRole('super_admin', 'admin'),
  purchaseOrderController.create
)
router.put(
  '/update/:id',
  requireRole('super_admin', 'admin'),
  purchaseOrderController.update
)
router.delete(
  '/delete/:id',
  requireRole('super_admin', 'admin'),
  purchaseOrderController.delete
)

// Receive/Cancel - Admin & Super Admin only
router.put(
  '/receive/:id',
  requireRole('super_admin', 'admin'),
  purchaseOrderController.receive
)
router.put(
  '/cancel/:id',
  requireRole('super_admin', 'admin'),
  purchaseOrderController.cancel
)

module.exports = router
