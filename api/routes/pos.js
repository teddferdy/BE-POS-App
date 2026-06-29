const express = require('express')
const router = express.Router()
const posController = require('../controller/pos')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Barcode lookup untuk POS scan
router.get(
  '/lookup-barcode',
  authorization,
  validateStoreAccess,
  posController.lookupBarcode
)

// Stock transfer antar toko — sent → received / cancelled
router.post(
  '/transfer',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.transfer
)
router.get(
  '/transfer-history',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.getTransferHistory
)
router.get(
  '/transfer/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.getTransferById
)
router.put(
  '/transfer/:id/receive',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.receiveTransfer
)
router.put(
  '/transfer/:id/cancel',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.cancelTransfer
)

// Stock adjustment
router.post(
  '/adjust',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.adjust
)

// Purchase order return
router.post(
  '/purchase-order/:id/return',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.returnPurchaseOrder
)

// Sales order return
router.post(
  '/order/:id/return',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.returnSalesOrder
)

// Loyalty points
router.get(
  '/member/:id/point-history',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.getPointHistory
)

// Dashboard data
router.get(
  '/dashboard/summary',
  authorization,
  validateStoreAccess,
  posController.getDashboardSummary
)

// Multi-store product price
router.get(
  '/product/price-by-store',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.getPriceByStore
)
router.put(
  '/product/update-price-by-store',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.updatePriceByStore
)

// Digital receipt (WA)
router.post(
  '/invoice/send-wa',
  authorization,
  validateStoreAccess,
  posController.sendInvoiceWhatsApp
)
router.post(
  '/invoice/send-email',
  authorization,
  validateStoreAccess,
  posController.sendInvoiceEmail
)

// WhatsApp connection management
router.get('/whatsapp/status', authorization, posController.getWhatsAppStatus)
router.post(
  '/whatsapp/logout',
  authorization,
  requireRole('super_admin', 'admin'),
  posController.logoutWhatsApp
)
router.post(
  '/whatsapp/restart',
  authorization,
  requireRole('super_admin', 'admin'),
  posController.restartWhatsApp
)

// Stock by batch/expiry
router.post(
  '/product/add-batch',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.addBatch
)
router.get(
  '/product/batches',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  posController.getBatches
)

module.exports = router
