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

module.exports = router
