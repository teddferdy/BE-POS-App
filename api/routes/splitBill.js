const express = require('express')
const router = express.Router()
const splitBillController = require('../controller/splitBill')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.post(
  '/create',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  splitBillController.create
)
router.get(
  '/get-by-order/:orderId',
  authorization,
  validateStoreAccess,
  splitBillController.getByOrder
)
router.put(
  '/pay/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  splitBillController.pay
)
router.delete(
  '/cancel/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  splitBillController.cancel
)
router.post(
  '/merge',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  splitBillController.merge
)

module.exports = router
