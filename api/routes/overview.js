const express = require('express')
const router = express.Router()
const overviewController = require('../controller/overview')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/product', authorization, validateStoreAccess, overviewController.getProductSummary)
router.get('/category', authorization, validateStoreAccess, overviewController.getCategorySummary)
router.get('/location', authorization, validateStoreAccess, overviewController.getLocationSummary)
router.get('/member', authorization, validateStoreAccess, overviewController.getMemberSummary)
router.get('/user', authorization, validateStoreAccess, overviewController.getUserSummary)
router.get('/best-selling', authorization, validateStoreAccess, overviewController.getBestSelling)
router.get(
  '/members/latest',
  authorization, validateStoreAccess,
  overviewController.getLatestMembers
)
router.get(
  '/categories/latest',
  authorization, validateStoreAccess,
  overviewController.getLatestCategories
)
router.get(
  '/locations/latest',
  authorization, validateStoreAccess,
  overviewController.getLatestLocations
)
router.get(
  '/products/latest',
  authorization, validateStoreAccess,
  overviewController.getLatestProducts
)

module.exports = router
