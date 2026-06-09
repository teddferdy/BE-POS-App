const express = require('express')
const multer = require('multer')
const router = express.Router()
const stockOpnameController = require('../controller/stockOpname')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

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

router.get('/get-all', authorization, validateStoreAccess, stockOpnameController.getAll)
router.get('/get-by-id/:id', authorization, validateStoreAccess, stockOpnameController.getById)
router.get('/check-exists', authorization, stockOpnameController.checkExists)
router.get('/composition-items', authorization, stockOpnameController.getCompositionItems)

router.post(
  '/create',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  stockOpnameController.create
)
router.put(
  '/update/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  stockOpnameController.update
)
router.delete(
  '/delete/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  stockOpnameController.delete
)

router.patch(
  '/status/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  stockOpnameController.changeStatus
)

router.get(
  '/download-excel',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  stockOpnameController.downloadExcel
)

router.post(
  '/export-selected',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  stockOpnameController.exportSelected
)

router.post(
  '/upload-excel',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  upload.single('file'),
  stockOpnameController.uploadExcel
)

module.exports = router
