const express = require('express')
const router = express.Router()

// Controller
const checkoutController = require('../controller/checkout')

// Authorization
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Add New Checkout
router.post(
  '/checkout-item',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  checkoutController.checkout
)

// Edit Checkout
router.put(
  '/edit-checkout-item',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  checkoutController.editCheckout
)

// Delete Checkout By Invoice & id
router.delete(
  '/delete-checkout-item',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  checkoutController.deleteCheckout
)

module.exports = router
