const express = require('express')
const router = express.Router()
const locationController = require('../controller/location')
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

const uploadImport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'images', maxCount: 50 }
])

// Location Template - Super Admin only
router.get(
  '/template',
  authorization, validateStoreAccess, requireRole('super_admin'),
  locationController.downloadTemplate
)

// Import Location - Super Admin only
router.post(
  '/import',
  authorization, validateStoreAccess, requireRole('super_admin'),
  uploadImport,
  locationController.importLocation
)

// Public - Get all active locations (for registration dropdown) - NO auth required
router.get('/get-location-public', locationController.getAllLocationPublic)

// Location CRUD
// Get all locations (for dropdown) - all authenticated users
router.get('/get-location', authorization, validateStoreAccess, locationController.getAllLocation)

// Get all locations in table - Super Admin only
router.get(
  '/get-location-all',
  authorization, validateStoreAccess, requireRole('super_admin'),
  locationController.getAllLocationInTable
)

// Get location detail - all authenticated users
router.get(
  '/get-location-detail/:locationId',
  authorization, validateStoreAccess,
  locationController.getLocationById
)

// Generate location ID - Super Admin only
router.get(
  '/generate-id',
  authorization, validateStoreAccess, requireRole('super_admin'),
  locationController.generateLocationId
)

// Add new location - Super Admin only
router.post(
  '/add-new-location',
  authorization, validateStoreAccess, requireRole('super_admin'),
  upload,
  locationController.addNewLocation
)

// Edit location - Super Admin only
router.put(
  '/edit-location',
  authorization, validateStoreAccess, requireRole('super_admin'),
  upload,
  locationController.editLocationById
)

// Delete location - Super Admin only
router.delete(
  '/delete-location',
  authorization, validateStoreAccess, requireRole('super_admin'),
  locationController.deleteLocationById
)

module.exports = router
