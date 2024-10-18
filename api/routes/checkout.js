const express = require('express')
const router = express.Router()

// Controller
const checkoutController = require('../controller/checkout')

// Authorization
const authorization = require('../../utils/authorization')

// Add New Checkout
router.post('/checkout-item', authorization, checkoutController?.checkout)

// Edit Checkout
router.put(
  '/edit-checkout-item',
  authorization,
  checkoutController?.editCheckout
)

// Delete Checkout By Invoice & id
router.delete(
  '/delete-checkout-item',
  authorization,
  checkoutController?.deleteCheckout
)

module.exports = router
