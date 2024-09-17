const express = require('express')
const router = express.Router()

const typePaymentController = require('../controller/type-payment')
// Authorization
const authorization = require('../../utils/authorization')

// Get All Type Payment
router.get('/get-type-payment', typePaymentController?.getAllTypePayment)

// Add Type Payment
router.post(
  '/add-new-type-payment',
  authorization,
  typePaymentController?.postNewTypePayment
)

// Edit Type Payment
router.put(
  '/edit-type-payment/:id',
  authorization,
  typePaymentController?.editTypePaymentById
)

// Delete Type Payment
router.delete(
  '/delete-type-payment/:id',
  authorization,
  typePaymentController?.deleteTypePaymentById
)

module.exports = router
