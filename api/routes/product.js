/* eslint-disable no-undef */
const express = require('express')

const router = express.Router()

// Authorization
const authorization = require('../../utils/authorization')
const productController = require('../controller/product')

// Post New Product
router.post('/add-product', authorization, productController?.postAddProduct)

router.get('/get-product', authorization, productController.getAllProduct)

// Function Delete
// router.post('/delete-product', productController?.deleteProduct)

// Render Form Edit Product
// router.get('/edit-product/:id', productController?.renderFormEdit)

// Router delete Image
// router.post('/delete-image', productController?.deleteImage)

// Router Render Category
// router.get('/add-category', productController?.renderAddCategory)

// Function Post Edit Product
// router.post(
//   '/edit-product/:id',
//   upload.single('image'),
//   productController?.EditProduct
// )

module.exports = router
