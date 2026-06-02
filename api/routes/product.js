const express = require('express')
const router = express.Router()
const productController = require('../controller/product')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const fs = require('fs')
const multer = require('multer')

const uploadDir = '/tmp/uploads'

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image')

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.includes('sheet') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Hanya file Excel yang diperbolehkan'))
    }
  }
})

const uploadImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
}).array('images', 50)

// Product Template - Admin & Super Admin only
router.get(
  '/template',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productController.downloadTemplate
)
router.post(
  '/import',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  uploadExcel.single('file'),
  uploadImages,
  productController.importProduct
)

// Product CRUD
// Read products - All authenticated users
router.get('/get-product', authorization, validateStoreAccess, productController.getAllProduct)
router.get(
  '/get-product-by-super-admin',
  authorization, validateStoreAccess,
  productController.getProductByLocationSuperAdmin
)
router.get(
  '/get-product-all',
  authorization, validateStoreAccess,
  productController.getAllProductInTable
)

// Create/Update/Delete - Admin & Super Admin only
router.post(
  '/add-product',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  upload,
  productController.postAddProduct
)
router.put(
  '/edit-product',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  upload,
  productController.editProductByLocationAndId
)
router.delete(
  '/delete-product/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productController.deleteProductByIdAndLocation
)

router.get(
  '/get-by-id/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productController.getProductById
)

module.exports = router
