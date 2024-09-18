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

router.get('/get-chart-selling', authorization, besSellingController?.chartData)

module.exports = router
