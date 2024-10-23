const express = require('express')
// Contollers
const authController = require('../controller/auth')

const authorization = require('../../utils/authorization')

const fs = require('fs')
const multer = require('multer')

// Define the writable upload directory for serverless environments
const uploadDir = '/tmp/uploads'

// Ensure the /tmp/uploads directory exists (required for AWS Lambda)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Set up multer storage using /tmp/uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir) // Save files to /tmp/uploads
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Set file size limit to 5MB
}).single('image')

const router = express.Router()

// Get User By Location
router.get('/get-user', authorization, authController?.userByLocation)

// Change Role User By Id & Location
router.put(
  '/change-profile-user',
  authorization,
  authController?.changeUserByIdAndLocation
)

// Get All User
router.get('/get-all-user', authorization, authController?.getAllUser)

// Login Post
router.post('/login', authController?.login)

// Function Post New Account
router.post('/register', authController?.registerNewUser)

// Function Reset Password
router.post('/reset-password', authController?.resetPassword)

// Function Edit User
router.put('/edit-user', authorization, upload, authController?.editUser)

// Logout
router.post('/logout', authController?.logout)

module.exports = router
