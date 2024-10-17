const express = require('express')
const router = express.Router()

const invoiceLogoController = require('../controller/invoice-logo')
const invoiceSocialMediaController = require('../controller/invoice-social-media')
const invoiceFooterController = require('../controller/invoice-footer')

// Authorization
const authorization = require('../../utils/authorization')

const fs = require('fs')
const multer = require('multer')

// Define the writable upload directory for serverless environments
const uploadDir = '/tmp/uploads'

// Ensure the /tmp/uploads directory exists (required for AWS Lambda)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Set up multer storage using /tmp/uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir) // Save files to /tmp/uploads
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Set file size limit to 5MB
}).single('image')

// ***************************** LOGO START *************************************

// Get Invoice Logo By Location
router.get(
  '/get-invoice-logo-by-location',
  authorization,
  invoiceLogoController?.getInvoiceLogoByLocation
)

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
  upload,
  invoiceLogoController?.postNewInvoiceLogo
)

// Edit Invoice Logo
router.put(
  '/edit-invoice-logo',
  authorization,
  upload,
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
  '/get-invoice-social-media-by-location',
  authorization,
  invoiceSocialMediaController?.getInvoiceSocialMediaByLocation
)

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
  '/get-invoice-footer-by-location',
  authorization,
  invoiceFooterController?.getInvoiceFooterByLocation
)

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
