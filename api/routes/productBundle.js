const express = require('express')
const router = express.Router()
const fs = require('fs')
const multer = require('multer')
const bundleController = require('../controller/productBundle')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

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

// ponytail: image bundle diupload multipart 'image' — sama seperti location
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image')

router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  bundleController.getAll
)

router.get(
  '/get-by-id/:id',
  authorization,
  validateStoreAccess,
  bundleController.getById
)

router.post(
  '/create',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  upload,
  bundleController.create
)

router.put(
  '/update/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  upload,
  bundleController.update
)

router.delete(
  '/delete/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  bundleController.delete
)

router.patch(
  '/status/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  bundleController.changeStatus
)

module.exports = router
