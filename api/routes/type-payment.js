const express = require('express')
const router = express.Router()

const typePaymentController = require('../controller/type-payment')
// Authorization
const authorization = require('../../utils/authorization')

// get Type Payment By Location And Active
router.get(
  '/get-type-payment',
  authorization,
  typePaymentController?.getAllTypePaymentByLocationAndActive
)

// Get All Type Payment
router.get(
  '/get-list-type-payment',
  authorization,
  typePaymentController?.getAllTypePayment
)

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
