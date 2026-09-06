const express = require('express')
const router = express.Router()
const parkedCartController = require('../controller/parkedCart')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const { createParkedCartSchema } = require('../validation/schemas')

// Parking/resuming/cancelling a cart is a routine POS operation, not an
// administrative one (unlike F2's cash movements) — no requireRole
// restriction, matching order.js's create/get-orders/get-order/
// update-status routes exactly (any authenticated store staff).
router.post(
  '/',
  authorization,
  validateStoreAccess,
  validate(createParkedCartSchema),
  parkedCartController.create
)
router.get(
  '/',
  authorization,
  validateStoreAccess,
  parkedCartController.list
)
router.get(
  '/:id',
  authorization,
  validateStoreAccess,
  parkedCartController.getOne
)
router.post(
  '/:id/resume',
  authorization,
  validateStoreAccess,
  parkedCartController.resume
)
router.post(
  '/:id/cancel',
  authorization,
  validateStoreAccess,
  parkedCartController.cancel
)

module.exports = router
