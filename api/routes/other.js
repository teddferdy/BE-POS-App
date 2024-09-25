const express = require('express')
const router = express.Router()

const otherController = require('../controller/other')

// Authorization
const authorization = require('../../utils/authorization')

// Get All Location
router.get('/get-years-list', authorization, otherController?.getListYears)

module.exports = router
