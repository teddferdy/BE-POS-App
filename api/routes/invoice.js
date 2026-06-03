const express = require('express')
const router = express.Router()
const invoiceController = require('../controller/invoice')
const authorization = require('../../utils/authorization')
const { requireRole } = authorization
const { validateStoreAccess } = require('../../utils/storeValidation')

const multer = require('multer')
const fs = require('fs')

const uploadDir = '/tmp/uploads'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files allowed'))
    }
  }
}).single('image')

router.get('/setting', authorization, validateStoreAccess, invoiceController.getSetting)
router.put('/setting', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), upload, invoiceController.updateSetting)

module.exports = router
