const express = require('express')
const router = express.Router()
const employeeController = require('../controller/employee')
const employeePerformanceController = require('../controller/employeePerformance')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createEmployeeSchema,
  updateUserSchema
} = require('../validation/schemas')
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
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
])

router.post(
  '/add-employee',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  upload,
  validate(createEmployeeSchema),
  employeeController.addEmployee
)

router.get(
  '/get-employee',
  authorization,
  validateStoreAccess,
  employeeController.getAllEmployee
)

router.get(
  '/get-employee/:id',
  authorization,
  validateStoreAccess,
  employeeController.getEmployeeById
)

router.get(
  '/get-employee-detail/:employeeID',
  authorization,
  validateStoreAccess,
  employeeController.getEmployeeByEmployeeID
)

router.put(
  '/edit-employee',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  upload,
  validate(updateUserSchema),
  employeeController.updateEmployee
)

router.delete(
  '/delete-employee/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  employeeController.deleteEmployee
)

// Employee performance (previously mounted under a second /employee router)
router.get(
  '/performance',
  authorization,
  validateStoreAccess,
  employeePerformanceController.getPerformance
)

router.get(
  '/:id/performance',
  authorization,
  validateStoreAccess,
  employeePerformanceController.getEmployeePerformance
)

router.get(
  '/top-performers',
  authorization,
  validateStoreAccess,
  employeePerformanceController.getTopPerformers
)

module.exports = router
