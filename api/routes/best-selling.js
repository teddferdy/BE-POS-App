const express = require('express')
const router = express.Router()

// Controller
const besSellingController = require('../controller/best-selling')

// Authorization
const authorization = require('../../utils/authorization')

// Get All List Category
router.get(
  '/get-best-selling',
  authorization,
  besSellingController?.getAllBestSelling
)

module.exports = router
