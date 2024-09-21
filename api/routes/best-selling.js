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

// Chart By Month
router.get(
  '/get-chart-by-month',
  authorization,
  besSellingController?.chartDataByMonth
)

// Chart Current Now & 2 Days Before
router.get(
  '/get-chart-current-and-two-days-before',
  authorization,
  besSellingController?.chartDataByCurrentDateAndTwoDaysBefore
)

// Chart Current Now & 7 Days Before
router.get(
  '/get-chart-current-and-seven-days-before',
  authorization,
  besSellingController?.chartDataByCurrentDateAndSevenDaysBefore
)

// Get Earning today
router.get(
  '/get-earning-today',
  authorization,
  besSellingController?.getEarningToday
)

module.exports = router
