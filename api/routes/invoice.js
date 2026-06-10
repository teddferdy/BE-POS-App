const express = require('express')
const router = express.Router()
const invoiceController = require('../controller/invoice')
const authorization = require('../../utils/authorization')
const { requireRole } = authorization
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/setting', authorization, validateStoreAccess, invoiceController.getSetting)
router.put('/setting', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), invoiceController.updateSetting)

module.exports = router
