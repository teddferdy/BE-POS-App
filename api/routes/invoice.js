const express = require('express')
const router = express.Router()

const invoiceController = require('../controller/invoice')
// Authorization
const authorization = require('../../utils/authorization')

// Get Invoice Logo By Active
router.get(
  '/get-invoice-logo-by-active',
  authorization,
  invoiceController?.getInvoiceLogoByIsActive
)

// Get All Invoice Logo
router.get(
  '/get-invoice-logo',
  authorization,
  invoiceController?.getAllInvoiceLogo
)

// Add Invoice Logo
router.post(
  '/add-new-invoice-logo',
  authorization,
  invoiceController?.postNewInvoiceLogo
)

// Edit Invoice Logo
router.put(
  '/edit-invoice-logo/:id',
  authorization,
  invoiceController?.editInvoiceLogoById
)

// Delete Invoice Logo
router.delete(
  '/delete-invoice-logo/:id',
  authorization,
  invoiceController?.deleteInvoiceLogoById
)

// Activate / Not Activate
router.put(
  '/activate-invoice-logo/:id',
  authorization,
  invoiceController?.activateInvoiceLogoById
)

module.exports = router
