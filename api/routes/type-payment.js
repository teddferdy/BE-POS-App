const express = require('express')
const router = express.Router()

const typePaymentController = require('../controller/type-payment')
// Authorization
const authorization = require('../../utils/authorization')
const { requireRole } = authorization
const { validateStoreAccess } = require('../../utils/storeValidation')

// get Type Payment By Location And Active
router.get(
  '/get-type-payment',
  authorization,
  validateStoreAccess,
  typePaymentController.getAllTypePaymentByLocationAndActive
)

// Get All Type Payment
router.get(
  '/get-list-type-payment',
  authorization,
  validateStoreAccess,
  typePaymentController.getAllTypePayment
)

// Add Type Payment
router.post(
  '/add-new-type-payment',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  typePaymentController.postNewTypePayment
)

// Edit Type Payment
router.put(
  '/edit-type-payment/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  typePaymentController.editTypePaymentById
)

// Delete Type Payment
router.delete(
  '/delete-type-payment/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  typePaymentController.deleteTypePaymentById
)

module.exports = router
