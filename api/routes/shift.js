const express = require('express')
const router = express.Router()

const shiftController = require('../controller/shift')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get All Shift - All authenticated users
router.get('/get-shift', shiftController.getAllShift)

// Get Shift Dropdown
router.get('/dropdown', shiftController.getShiftDropdown)

// Add/Edit/Delete Shift - Admin & Super Admin only
router.post(
  '/add-new-shift',
  requireRole('super_admin', 'admin'),
  shiftController.postNewShift
)
router.put(
  '/edit-shift/:id',
  requireRole('super_admin', 'admin'),
  shiftController.editShiftById
)
router.delete(
  '/delete-shift/:id',
  requireRole('super_admin', 'admin'),
  shiftController.deleteShiftById
)

module.exports = router
