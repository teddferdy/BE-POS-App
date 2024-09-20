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

// Chart
router.get('/get-chart-selling', authorization, besSellingController?.chartData)

// Chart Current Now & Seven Days Before
router.get(
  '/get-chart-current-and-seven-days-before',
  authorization,
  besSellingController?.chartDataByCurrentDateAndSevenDaysBefore
)

module.exports = router
