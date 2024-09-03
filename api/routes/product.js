const express = require('express')
const multer = require('multer')
const path = require('path')
const router = express.Router()

// Authorization
const authorization = require('../../utils/authorization')
const productController = require('../controller/product')

const storage = multer.diskStorage({
  destination: function (req, res, cb) {
    cb(null, './assets/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: '1000000'
  },
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/
    const mimeType = fileTypes.test(file.mimetype)
    const extName = fileTypes.test(path.extname(file.originalname))

    if (mimeType && extName) {
      return cb(null, true)
    }
    cb('Give Proper files Formater to upload')
  }
}).single('image')

// Post New Product
router.post(
  '/add-product',
  upload,
  authorization,
  productController?.postAddProduct
)

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
