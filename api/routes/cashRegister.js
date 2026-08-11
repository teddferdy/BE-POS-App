const express = require('express')
const router = express.Router()
const cashRegisterController = require('../controller/cashRegister')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createCashRegisterSchema,
  updateCashRegisterSchema
} = require('../validation/schemas')

router.post(
  '/open',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createCashRegisterSchema),
  cashRegisterController.open
)
router.put(
  '/close/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateCashRegisterSchema),
  cashRegisterController.close
)
router.get(
  '/current',
  authorization,
  validateStoreAccess,
  cashRegisterController.getCurrent
)
router.get(
  '/open-registers',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  cashRegisterController.getOpenRegisters
)
router.get(
  '/history',
  authorization,
  validateStoreAccess,
  cashRegisterController.getHistory
)
router.get(
  '/x-report',
  authorization,
  validateStoreAccess,
  cashRegisterController.getXReport
)
router.get(
  '/z-report/:id',
  authorization,
  validateStoreAccess,
  cashRegisterController.getZReport
)

module.exports = router
