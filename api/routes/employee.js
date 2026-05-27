const express = require('express')
const router = express.Router()
const employeeController = require('../controller/employee')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
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
  requireRole('super_admin', 'admin'),
  upload,
  employeeController.addEmployee
)

router.get('/get-employee', authorization, employeeController.getAllEmployee)

router.get(
  '/get-employee/:id',
  authorization,
  employeeController.getEmployeeById
)

router.get(
  '/get-employee-detail/:employeeID',
  authorization,
  employeeController.getEmployeeByEmployeeID
)

router.put(
  '/edit-employee',
  requireRole('super_admin', 'admin'),
  upload,
  employeeController.updateEmployee
)

router.delete(
  '/delete-employee/:id',
  requireRole('super_admin', 'admin'),
  employeeController.deleteEmployee
)

module.exports = router
