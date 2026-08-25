const express = require('express')
const router = express.Router()
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const purchaseReturnController = require('../controller/purchaseReturn')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const { createPurchaseReturnSchema } = require('../validation/schemas')

const uploadDir = '/tmp/uploads'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`
    cb(null, unique)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'), false)
  }
})

router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  purchaseReturnController.getAll
)
router.get(
  '/get-by-id/:id',
  authorization,
  validateStoreAccess,
  purchaseReturnController.getById
)
router.get(
  '/by-po/:poId',
  authorization,
  validateStoreAccess,
  purchaseReturnController.getByPO
)

router.post(
  '/create',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  upload.array('file', 5),
  purchaseReturnController.create
)

router.patch(
  '/approve/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  purchaseReturnController.approve
)
router.patch(
  '/reject/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  purchaseReturnController.reject
)

module.exports = router
