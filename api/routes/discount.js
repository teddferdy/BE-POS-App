const express = require('express')
const router = express.Router()

const discountController = require('../controller/discount')
// Authorization
const authorization = require('../../utils/authorization')

// Get All Discount
router.get('/get-discount', discountController?.getAllDiscount)

// Add Discount
router.post(
  '/add-new-discount',
  authorization,
  discountController?.postNewDiscount
)

// Edit Location
router.put(
  '/edit-discount/:id',
  authorization,
  discountController?.editDiscountById
)

// Delete Location
router.delete(
  '/edit-discount/:id',
  authorization,
  discountController?.editDiscountById
)

module.exports = router
