const express = require('express')
const router = express.Router()

const overviewController = require('../controller/overview')

// Authorization
const authorization = require('../../utils/authorization')

// Get Product
router.get('/get-product', authorization, overviewController?.getProduct)

// Get Category
router.get('/get-category', authorization, overviewController?.getCategory)

// Get Location
router.get('/get-location', authorization, overviewController?.getLocation)

// Get Member
router.get('/get-member', authorization, overviewController?.getMember)

// Get User
router.get('/get-user', authorization, overviewController?.getUser)

// Get Member List By Latest For Table
router.get(
  '/get-member-latest',
  authorization,
  overviewController?.getMemberDescending
)

// Get Category List By Latest For Table
router.get(
  '/get-category-latest',
  authorization,
  overviewController?.getCategoryDescending
)

// Get Location List By Latest For Table
router.get(
  '/get-location-latest',
  authorization,
  overviewController?.getLocationDescending
)

// Get Product List By Latest For Table
router.get(
  '/get-product-latest',
  authorization,
  overviewController?.getProductDescending
)

module.exports = router
