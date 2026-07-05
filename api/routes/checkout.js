const express = require('express')
const router = express.Router()

// Controller
const checkoutController = require('../controller/checkout')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const { createCheckoutSchema } = require('../validation/schemas')

// Add New Checkout
router.post(
  '/checkout-item',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createCheckoutSchema),
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
