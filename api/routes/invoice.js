const express = require('express')
const router = express.Router()

const invoiceLogoController = require('../controller/invoice-logo')
const invoiceSocialMediaController = require('../controller/invoice-social-media')
const invoiceFooterController = require('../controller/invoice-footer')

// Authorization
const authorization = require('../../utils/authorization')

// ***************************** LOGO START *************************************
// Get Invoice Logo By Active
router.get(
  '/get-invoice-logo-by-active',
  authorization,
  invoiceLogoController?.getInvoiceLogoByIsActive
)

// Get All Invoice Logo
router.get(
  '/get-invoice-logo',
  authorization,
  invoiceLogoController?.getAllInvoiceLogo
)

// Add Invoice Logo
router.post(
  '/add-new-invoice-logo',
  authorization,
  invoiceLogoController?.postNewInvoiceLogo
)

// Edit Invoice Logo
router.put(
  '/edit-invoice-logo/:id',
  authorization,
  invoiceLogoController?.editInvoiceLogoById
)

// Delete Invoice Logo
router.delete(
  '/delete-invoice-logo/:id',
  authorization,
  invoiceLogoController?.deleteInvoiceLogoById
)

// Activate / Not Activate Invoice Logo
router.put(
  '/activate-invoice-logo/:id',
  authorization,
  invoiceLogoController?.activateInvoiceLogoById
)
// ***************************** LOGO END *************************************

// ***************************** SOCIAL MEDIA START *************************************
router.get(
  '/get-invoice-social-media-by-active',
  authorization,
  invoiceSocialMediaController?.getInvoiceSocialMediaByIsActive
)

// Get All Invoice Logo
router.get(
  '/get-invoice-social-media',
  authorization,
  invoiceSocialMediaController?.getAllInvoiceSocialMedia
)

// Add Invoice Logo
router.post(
  '/add-new-invoice-social-media',
  authorization,
  invoiceSocialMediaController?.postNewInvoiceSocialMedia
)

// Edit Invoice Logo
router.put(
  '/edit-invoice-social-media/:id',
  authorization,
  invoiceSocialMediaController?.editInvoiceSocialMediaById
)

// Delete Invoice Logo
router.delete(
  '/delete-invoice-social-media/:id',
  authorization,
  invoiceSocialMediaController?.deleteInvoiceSocialMediaById
)

// Activate / Not Activate Invoice Logo
router.put(
  '/activate-invoice-social-media/:id',
  authorization,
  invoiceSocialMediaController?.activateInvoiceSocialMediaById
)
// ***************************** SOCIAL MEDIA END *************************************

// ***************************** FOOTER START *************************************
router.get(
  '/get-invoice-footer-by-active',
  authorization,
  invoiceFooterController?.getInvoiceFooterByIsActive
)

// Get All Invoice Logo
router.get(
  '/get-invoice-footer',
  authorization,
  invoiceFooterController?.getAllInvoiceFooter
)

// Add Invoice Logo
router.post(
  '/add-new-invoice-footer',
  authorization,
  invoiceFooterController?.postNewInvoiceFooter
)

// Edit Invoice Logo
router.put(
  '/edit-invoice-footer/:id',
  authorization,
  invoiceFooterController?.editInvoiceFooterById
)

// Delete Invoice Logo
router.delete(
  '/delete-invoice-footer/:id',
  authorization,
  invoiceFooterController?.deleteInvoiceFooterById
)

// Activate / Not Activate Invoice Logo
router.put(
  '/activate-invoice-footer/:id',
  authorization,
  invoiceFooterController?.activateInvoiceFooterById
)

// ***************************** FOOTER END *************************************

module.exports = router
