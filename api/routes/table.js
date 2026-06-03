const express = require('express')
const router = express.Router()
const tableController = require('../controller/table')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Get tables - All authenticated users
router.get('/get-tables', authorization, validateStoreAccess, tableController.getTablesByStore)
router.get(
  '/get-tables-with-orders',
  authorization, validateStoreAccess,
  tableController.getTableWithActiveOrders
)
router.get(
  '/get-availability',
  authorization, validateStoreAccess,
  tableController.getTableAvailability
)

// Create/Update/Delete - Admin & Super Admin only
router.post(
  '/create',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  tableController.createTable
)
router.put(
  '/update/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  tableController.updateTable
)
router.delete(
  '/delete/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  tableController.deleteTable
)

// Update status - All authenticated users (for POS)
router.put('/update-status/:id', authorization, validateStoreAccess, tableController.updateTableStatus)

module.exports = router
