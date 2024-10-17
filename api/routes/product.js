/* eslint-disable no-undef */
const express = require('express')

const router = express.Router()

const productController = require('../controller/product')

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

// Post New Product
router.post(
  '/add-product',
  authorization,
  upload, // Use multer middleware for handling file uploads
  productController?.postAddProduct
)

// Get Product In Cashier List By Location
router.get('/get-product', authorization, productController?.getAllProduct)

// Get Product In By Location Super Admin List
router.get(
  '/get-product-by-super-admin',
  authorization,
  productController?.getProductByLocationSuperAdmin
)

// Get Product In Table
router.get(
  '/get-product-all',
  authorization,
  productController?.getAllProductInTable
)

// Render Form Edit Product
router.put(
  '/edit-product/:id',
  authorization,
  productController?.editProductByLocationAndId
)

// Function Delete
router.delete(
  '/delete-product/:id',
  authorization,
  productController?.deleteProductByIdAndLocation
)

module.exports = router
