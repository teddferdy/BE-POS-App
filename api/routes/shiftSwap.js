const express = require('express')
const router = express.Router()

const shiftSwapController = require('../controller/shiftSwap')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createShiftSwapSchema,
  updateShiftSwapStatusSchema
} = require('../validation/schemas')

router.get(
  '/get-swap',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  shiftSwapController.getShiftSwaps
)

router.post(
  '/create-swap',
  authorization,
  validateStoreAccess,
  validate(createShiftSwapSchema),
  shiftSwapController.createShiftSwap
)

router.put(
  '/update-swap-status/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateShiftSwapStatusSchema),
  shiftSwapController.updateShiftSwapStatus
)

module.exports = router