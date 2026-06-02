const express = require('express')
const router = express.Router()
const receiptController = require('../controller/receipt')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/order/:orderId', authorization, validateStoreAccess, receiptController.getOrderReceipt)

module.exports = router
