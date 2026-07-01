const express = require('express')
const router = express.Router()
const purchaseReturnController = require('../controller/purchaseReturn')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  purchaseReturnController.getAll
)
router.get(
  '/get-by-id/:id',
  authorization,
  validateStoreAccess,
  purchaseReturnController.getById
)
router.get(
  '/by-po/:poId',
  authorization,
  validateStoreAccess,
  purchaseReturnController.getByPO
)

router.post(
  '/create',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  purchaseReturnController.create
)

router.patch(
  '/approve/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  purchaseReturnController.approve
)
router.patch(
  '/reject/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  purchaseReturnController.reject
)

module.exports = router
