const express = require('express')
const authController = require('../controller/auth')

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
}).single('image')

const router = express.Router()

// Login Post
router.post('/login', authController.login)

// Register (public)
router.post('/register', authController.registerNewUser)

// Get User By Location (all authenticated users)
router.get('/get-user', authorization, authController.userByLocation)

// Get All User - Super Admin only
router.get(
  '/get-all-user',
  requireRole('super_admin'),
  authController.getAllUser
)

// Change Role User By Id & Location - Admin/Super Admin
router.put(
  '/change-profile-user',
  requireRole('super_admin', 'admin'),
  authController.changeUserByIdAndLocation
)

// Generate Employee ID
router.get(
  '/generate-employee-id',
  authorization,
  authController.generateEmployeeId
)

// Reset Password
router.post('/reset-password', authorization, authController.resetPassword)

// Edit User - based on role
router.put('/edit-user', authorization, upload, authController.editUser)

// Logout
router.post('/logout', authorization, authController.logout)

module.exports = router
