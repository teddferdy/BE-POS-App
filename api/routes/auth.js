const express = require('express')
const rateLimit = require('express-rate-limit')
const authController = require('../controller/auth')

// ponytail: 10 login attempts per 15min window, upgrade: per-IP tracking with Redis if multi-instance
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts, try again later.'
  }
})

const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validate } = require('../middleware/validate')
const {
  loginSchema,
  registerSchema,
  resetPasswordSchema
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
}).single('image')

const router = express.Router()

// Login Post
router.post('/login', loginLimiter, validate(loginSchema), authController.login)

// Register (public)
router.post(
  '/register',
  validate(registerSchema),
  authController.registerNewUser
)

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

// Reset Password (public - no auth required)
router.post('/reset-password', authController.resetPassword)

// Edit User - based on role
router.put('/edit-user', authorization, upload, authController.editUser)

// Logout
router.post('/logout', authorization, authController.logout)

module.exports = router
