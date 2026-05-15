const express = require('express')
const router = express.Router()
const invoiceController = require('../controller/invoice')
const authorization = require('../../utils/authorization')

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
    if (file.mimetype.includes('sheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true)
    } else {
      cb(new Error('Only Excel files allowed'))
    }
  }
}).single('file')

router.get('/logo', authorization, invoiceController.getLogo)
router.get('/logo/active', authorization, invoiceController.getLogoActive)
router.post('/logo', authorization, upload, invoiceController.createLogo)
router.put('/logo/:id', authorization, upload, invoiceController.updateLogo)
router.delete('/logo/:id', authorization, invoiceController.deleteLogo)
router.put('/logo/:id/activate', authorization, invoiceController.activateLogo)
router.get('/logo/template', authorization, invoiceController.downloadLogoTemplate)
router.post('/logo/import', authorization, uploadExcel, invoiceController.importLogo)

router.get('/social-media', authorization, invoiceController.getSocialMedia)
router.get('/social-media/active', authorization, invoiceController.getSocialMediaActive)
router.post('/social-media', authorization, invoiceController.createSocialMedia)
router.put('/social-media/:id', authorization, invoiceController.updateSocialMedia)
router.delete('/social-media/:id', authorization, invoiceController.deleteSocialMedia)
router.put('/social-media/:id/activate', authorization, invoiceController.activateSocialMedia)

router.get('/footer', authorization, invoiceController.getFooter)
router.get('/footer/active', authorization, invoiceController.getFooterActive)
router.post('/footer', authorization, invoiceController.createFooter)
router.put('/footer/:id', authorization, invoiceController.updateFooter)
router.delete('/footer/:id', authorization, invoiceController.deleteFooter)
router.put('/footer/:id/activate', authorization, invoiceController.activateFooter)

router.get('/all', authorization, invoiceController.getAll)

module.exports = router