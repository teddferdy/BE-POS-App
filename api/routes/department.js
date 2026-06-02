const express = require('express')
const multer = require('multer')
const router = express.Router()

const departmentController = require('../controller/department')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

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

router.get('/get-department', authorization, validateStoreAccess, departmentController.getAllDepartment)

router.get(
  '/get-department-all',
  authorization, validateStoreAccess,
  departmentController.getAllDepartmentInTable
)

router.get(
  '/get-department/:id',
  authorization, validateStoreAccess,
  departmentController.getDepartmentById
)

router.post(
  '/add-new-department',
  authorization, validateStoreAccess,
  departmentController.addNewDepartment
)

router.put(
  '/edit-department/:id',
  authorization, validateStoreAccess,
  departmentController.editDepartmentById
)

router.delete(
  '/delete-department/:id',
  authorization, validateStoreAccess,
  departmentController.deleteDepartmentById
)

// Excel upload/download routes
router.get(
  '/download-template',
  authorization, validateStoreAccess,
  departmentController.downloadTemplate
)

router.get(
  '/download',
  authorization, validateStoreAccess,
  departmentController.downloadData
)

router.post(
  '/upload',
  authorization, validateStoreAccess,
  upload.single('file'),
  departmentController.uploadExcel
)

module.exports = router
