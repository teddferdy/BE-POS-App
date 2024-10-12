const express = require('express')
const router = express.Router()

const discountController = require('../controller/discount')
// Authorization
const authorization = require('../../utils/authorization')

// Get All Discount
router.get(
  '/get-discount-by-location',
  authorization,
  discountController?.getAllDiscountByLocationAndActive
)

router.get('/get-discount', authorization, discountController?.getAllDiscount)

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
  '/delete-discount/:id',
  authorization,
  discountController?.deleteDiscountById
)

module.exports = router
