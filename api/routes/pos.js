const express = require('express')
const router = express.Router()
const posController = require('../controller/pos')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Barcode lookup untuk POS scan
router.get('/lookup-barcode', authorization, posController.lookupBarcode)

// Stock transfer antar toko
router.post('/transfer', authorization, requireRole('super_admin', 'admin'), posController.transfer)
router.get('/transfer-history', authorization, requireRole('super_admin', 'admin'), posController.getTransferHistory)

// Stock adjustment
router.post('/adjust', authorization, requireRole('super_admin', 'admin'), posController.adjust)

// Purchase order return
router.post('/purchase-order/:id/return', authorization, requireRole('super_admin', 'admin'), posController.returnPurchaseOrder)

// Sales order return
router.post('/order/:id/return', authorization, requireRole('super_admin', 'admin'), posController.returnSalesOrder)

// Loyalty points
router.post('/member/:id/add-points', authorization, requireRole('super_admin', 'admin'), posController.addPoints)
router.get('/member/:id/point-history', authorization, requireRole('super_admin', 'admin'), posController.getPointHistory)

// Dashboard data
router.get('/dashboard/summary', authorization, posController.getDashboardSummary)

// Multi-store product price
router.get('/product/price-by-store', authorization, requireRole('super_admin', 'admin'), posController.getPriceByStore)
router.put('/product/update-price-by-store', authorization, requireRole('super_admin', 'admin'), posController.updatePriceByStore)

// Digital receipt (WA)
router.post('/invoice/send-wa', authorization, posController.sendInvoiceWhatsApp)
router.post('/invoice/send-email', authorization, posController.sendInvoiceEmail)

// Stock by batch/expiry
router.post('/product/add-batch', authorization, requireRole('super_admin', 'admin'), posController.addBatch)
router.get('/product/batches', authorization, requireRole('super_admin', 'admin'), posController.getBatches)

module.exports = router