const express = require('express')

const router = express.Router()

// Authorization
const authorization = require('../../utils/authorization')

const controllerTypePayment = require('../controller/type-payment')

// Get All Sub Category
router.get(
  '/get-all-type-payment',
  authorization,
  controllerTypePayment?.getAllTypePayment
)

// Adding Option By Id Product
router.post(
  '/add-type-payment',
  authorization,
  controllerTypePayment?.postNewTypePayment
)

// Edit Location
router.put(
  '/edit-type-payment/:id',
  authorization,
  controllerTypePayment?.editTypePaymentById
)

// Delete Location
router.delete(
  '/delete-type-payment/:id',
  authorization,
  controllerTypePayment?.deleteTypePaymentById
)

module.exports = router
