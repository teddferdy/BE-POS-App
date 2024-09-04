const express = require('express')
const router = express.Router()

// Controller
const checkoutController = require('../controller/checkout')

// Authorization
const authorization = require('../../utils/authorization')

// Add New Category
router.post('/checkout', authorization, checkoutController?.checkout)

module.exports = router
