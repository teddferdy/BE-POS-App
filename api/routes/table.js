const express = require('express')
const router = express.Router()
const tableController = require('../controller/table')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get tables - All authenticated users
router.get('/get-tables', authorization, tableController.getTablesByStore)
router.get(
  '/get-tables-with-orders',
  authorization,
  tableController.getTableWithActiveOrders
)
router.get(
  '/get-availability',
  authorization,
  tableController.getTableAvailability
)

// Create/Update/Delete - Admin & Super Admin only
router.post(
  '/create',
  requireRole('super_admin', 'admin'),
  tableController.createTable
)
router.put(
  '/update',
  requireRole('super_admin', 'admin'),
  tableController.updateTable
)
router.delete(
  '/delete/:id',
  requireRole('super_admin', 'admin'),
  tableController.deleteTable
)

// Update status - All authenticated users (for POS)
router.put('/update-status', authorization, tableController.updateTableStatus)

module.exports = router
