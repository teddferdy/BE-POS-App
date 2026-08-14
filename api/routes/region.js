const express = require('express')
const router = express.Router()

const regionController = require('../controller/region')
const authorization = require('../../utils/authorization')

router.get('/provinces', authorization, regionController.getProvince)
router.get('/regencies', authorization, regionController.getRegency)
router.get('/districts', authorization, regionController.getDistrict)
router.get('/villages', authorization, regionController.getVillage)
router.get('/postal-codes', authorization, regionController.getPostalCode)
router.get('/regions', authorization, regionController.getRegion)

module.exports = router
