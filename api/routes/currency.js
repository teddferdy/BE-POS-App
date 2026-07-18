const express = require('express')
const router = express.Router()
const currencyController = require('../controller/currency')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createCurrencySchema,
  updateCurrencySchema
} = require('../validation/schemas')

router.get('/', authorization, validateStoreAccess, currencyController.getAll)
router.get(
  '/:id',
  authorization,
  validateStoreAccess,
  currencyController.getById
)
router.post(
  '/',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createCurrencySchema),
  currencyController.create
)
router.put(
  '/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateCurrencySchema),
  currencyController.update
)
router.delete(
  '/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  currencyController.delete
)
router.put(
  '/:id/default',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  currencyController.setDefault
)

module.exports = router
