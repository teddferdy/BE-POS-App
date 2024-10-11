/* eslint-disable no-undef */
const express = require('express')

const router = express.Router()

const productController = require('../controller/product')

// Authorization
const authorization = require('../../utils/authorization')

// Post New Product
router.post('/add-product', authorization, productController?.postAddProduct)

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
