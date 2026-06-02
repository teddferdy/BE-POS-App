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
      cb(new Error('Only Excel files allowed'))
    }
  }
}).single('file')

router.get('/logo', authorization, validateStoreAccess, invoiceController.getLogo)
router.get('/logo/active', authorization, validateStoreAccess, invoiceController.getLogoActive)
router.post('/logo', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), upload, invoiceController.createLogo)
router.put('/logo/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), upload, invoiceController.updateLogo)
router.delete('/logo/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), invoiceController.deleteLogo)
router.put('/logo/:id/activate', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), invoiceController.activateLogo)
router.get(
  '/logo/template',
  authorization,
  validateStoreAccess,
  invoiceController.downloadLogoTemplate
)
router.post(
  '/logo/import',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  uploadExcel,
  invoiceController.importLogo
)

router.get('/social-media', authorization, validateStoreAccess, invoiceController.getSocialMedia)
router.get(
  '/social-media/active',
  authorization,
  validateStoreAccess,
  invoiceController.getSocialMediaActive
)
router.post('/social-media', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), invoiceController.createSocialMedia)
router.put(
  '/social-media/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  invoiceController.updateSocialMedia
)
router.delete(
  '/social-media/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  invoiceController.deleteSocialMedia
)
router.put(
  '/social-media/:id/activate',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  invoiceController.activateSocialMedia
)

router.get('/footer', authorization, validateStoreAccess, invoiceController.getFooter)
router.get('/footer/active', authorization, validateStoreAccess, invoiceController.getFooterActive)
router.post('/footer', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), invoiceController.createFooter)
router.put('/footer/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), invoiceController.updateFooter)
router.delete('/footer/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), invoiceController.deleteFooter)
router.put(
  '/footer/:id/activate',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  invoiceController.activateFooter
)

router.get('/all', authorization, validateStoreAccess, invoiceController.getAll)

module.exports = router
