const express = require('express')
const router = express.Router()
const overviewController = require('../controller/overview')
const authorization = require('../../utils/authorization')

router.get('/dashboard', authorization, overviewController.getDashboard)
router.get('/product', authorization, overviewController.getProductSummary)
router.get('/category', authorization, overviewController.getCategorySummary)
router.get('/location', authorization, overviewController.getLocationSummary)
router.get('/member', authorization, overviewController.getMemberSummary)
router.get('/user', authorization, overviewController.getUserSummary)
router.get('/best-selling', authorization, overviewController.getBestSelling)
router.get(
  '/members/latest',
  authorization,
  overviewController.getLatestMembers
)
router.get(
  '/categories/latest',
  authorization,
  overviewController.getLatestCategories
)
router.get(
  '/locations/latest',
  authorization,
  overviewController.getLatestLocations
)
router.get(
  '/products/latest',
  authorization,
  overviewController.getLatestProducts
)

module.exports = router
