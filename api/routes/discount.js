const express = require('express')
const router = express.Router()

const discountController = require('../controller/discount')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get All Discount - All authenticated users
router.get(
  '/get-discount-by-location',
  authorization,
  discountController.getAllDiscountByLocationAndActive
)
router.get('/get-discount', authorization, discountController.getAllDiscount)

// Add Discount - Admin & Super Admin only
router.post(
  '/add-new-discount',
  requireRole('super_admin', 'admin'),
  discountController.postNewDiscount
)

// Edit Discount - Admin & Super Admin only
router.put(
  '/edit-discount/:id',
  requireRole('super_admin', 'admin'),
  discountController.editDiscountById
)

// Delete Discount - Admin & Super Admin only
router.delete(
  '/delete-discount/:id',
  requireRole('super_admin', 'admin'),
  discountController.deleteDiscountById
)

module.exports = router
