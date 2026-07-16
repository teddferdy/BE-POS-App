const express = require('express')
const router = express.Router()
const bundleController = require('../controller/productBundle')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  bundleController.getAll
)

router.get(
  '/get-by-id/:id',
  authorization,
  validateStoreAccess,
  bundleController.getById
)

router.post(
  '/create',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  bundleController.create
)

router.put(
  '/update/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  bundleController.update
)

router.delete(
  '/delete/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  bundleController.delete
)

router.patch(
  '/status/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  bundleController.changeStatus
)

module.exports = router
