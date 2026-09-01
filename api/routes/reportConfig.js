'use strict'
const express = require('express')
const router = express.Router()
const reportConfigController = require('../controller/reportConfig')
const authorization = require('../../utils/authorization')

router.get('/', authorization, reportConfigController.listConfigs)
router.get('/meta', authorization, reportConfigController.getMeta)
router.get('/:key', authorization, reportConfigController.getConfig)
router.put('/:key', authorization, reportConfigController.upsertConfig)

module.exports = router