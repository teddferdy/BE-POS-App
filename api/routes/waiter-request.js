const express = require('express')
const router = express.Router()
const waiterRequestController = require('../controller/waiter-request')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// ─── Customer-facing (no auth) ─────────────────────────────────
router.post('/customer-create', waiterRequestController.customerCreate)
router.get('/customer-list', waiterRequestController.getCustomerList)

// ─── Admin ─────────────────────────────────────────────────────
router.get(
  '/pending',
  authorization,
  validateStoreAccess,
  waiterRequestController.getPendingList
)

router.get(
  '/',
  authorization,
  validateStoreAccess,
  waiterRequestController.getList
)

router.put(
  '/:id/status',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin', 'kasir'),
  waiterRequestController.updateStatus
)

module.exports = router
