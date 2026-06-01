const express = require('express')
const multer = require('multer')
const router = express.Router()
const stockOpnameController = require('../controller/stockOpname')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

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
  limits: { fileSize: 10 * 1024 * 1024 }
})

router.get('/get-all', authorization, stockOpnameController.getAll)
router.get('/get-by-id/:id', authorization, stockOpnameController.getById)

router.post(
  '/create',
  requireRole('super_admin', 'admin'),
  stockOpnameController.create
)
router.put(
  '/update/:id',
  requireRole('super_admin', 'admin'),
  stockOpnameController.update
)
router.delete(
  '/delete/:id',
  requireRole('super_admin', 'admin'),
  stockOpnameController.delete
)

router.patch(
  '/status/:id',
  requireRole('super_admin', 'admin'),
  stockOpnameController.changeStatus
)

router.get(
  '/download-excel',
  requireRole('super_admin', 'admin'),
  stockOpnameController.downloadExcel
)

router.post(
  '/export-selected',
  requireRole('super_admin', 'admin'),
  stockOpnameController.exportSelected
)

router.post(
  '/upload-excel',
  requireRole('super_admin', 'admin'),
  upload.single('file'),
  stockOpnameController.uploadExcel
)

module.exports = router
