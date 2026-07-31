const express = require('express')
const router = express.Router()
const salesReturnController = require('../controller/salesReturn')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  approveSalesReturnSchema,
  rejectSalesReturnSchema
} = require('../validation/schemas')

router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  salesReturnController.getAll
)

router.get(
  '/get-by-id/:id',
  authorization,
  validateStoreAccess,
  salesReturnController.getById
)

router.patch(
  '/approve/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(approveSalesReturnSchema),
  salesReturnController.approve
)

router.patch(
  '/reject/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(rejectSalesReturnSchema),
  salesReturnController.reject
)

module.exports = router
