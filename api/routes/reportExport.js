'use strict'
const express = require('express')
const router = express.Router()
const reportExportController = require('../controller/reportExport')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/export/:key', authorization, validateStoreAccess, reportExportController.exportOne)

module.exports = router
