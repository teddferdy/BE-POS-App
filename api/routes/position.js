const express = require('express')
const multer = require('multer')
const router = express.Router()

const positionController = require('../controller/position')
// Authorization
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ]
    if (allowedMimes.includes(file.mimetype) ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true)
    } else {
      cb(new Error('File harus berupa Excel (.xlsx atau .xls)'), false)
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// Get All position
router.get('/get-position', positionController.getAllPosition)

// Get position by ID
router.get(
  '/get-position/:id',
  authorization,
  positionController.getPositionById
)

// Get All List To Table
router.get(
  '/get-position-all',
  authorization,
  positionController.getAllPositionInTable
)

// Add position
router.post(
  '/add-new-position',
  authorization,
  requireRole('super_admin', 'admin'),
  positionController.addNewPosition
)

// Edit position
router.put(
  '/edit-position/:id',
  authorization,
  requireRole('super_admin', 'admin'),
  positionController.editPositionById
)

// Delete position
router.delete(
  '/delete-position/:id',
  authorization,
  requireRole('super_admin', 'admin'),
  positionController.deletePositionById
)

// Excel upload/download routes
router.get(
  '/download-template',
  authorization,
  positionController.downloadTemplate
)

router.get(
  '/download',
  authorization,
  positionController.downloadData
)

router.post(
  '/upload',
  authorization,
  requireRole('super_admin', 'admin'),
  upload.single('file'),
  positionController.uploadExcel
)

module.exports = router
