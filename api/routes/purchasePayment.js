const express = require('express')
const router = express.Router()
const purchasePaymentController = require('../controller/purchasePayment')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/by-po/:poId', authorization, validateStoreAccess, purchasePaymentController.getByPO)
router.get('/by-supplier/:supplierId', authorization, validateStoreAccess, purchasePaymentController.getBySupplier)
router.get('/list', authorization, validateStoreAccess, purchasePaymentController.list)
router.post('/create', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), purchasePaymentController.record)
router.delete('/delete/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), purchasePaymentController.delete)

module.exports = router
