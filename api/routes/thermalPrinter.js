const express = require('express');
const router = express.Router();
const thermalPrinterController = require('../controller/thermalPrinter');
const authorization = require('../../utils/authorization');
const { requireRole } = require('../../utils/authorization');
const { validateStoreAccess } = require('../../utils/storeValidation');

// All routes require authentication
router.use(authorization);
router.use(validateStoreAccess);

// Print receipt (cashier and admin)
router.post(
  '/print',
  requireRole('super_admin', 'admin', 'kasir'),
  thermalPrinterController.printReceipt
);

// Test print (super_admin, admin)
router.post(
  '/test-print',
  requireRole('super_admin', 'admin'),
  thermalPrinterController.testPrint
);

// Get printer status (super_admin, admin)
router.get(
  '/status',
  requireRole('super_admin', 'admin'),
  thermalPrinterController.getPrinterStatus
);

// Configure printer (super_admin only)
router.post(
  '/configure',
  requireRole('super_admin'),
  thermalPrinterController.configurePrinter
);

module.exports = router;
