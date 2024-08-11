const express = require('express')
// Contollers
const authController = require('../controller/auth')

const router = express.Router()

// Form Login
router.get('/get-all-user', authController?.getAllUser)

// Login Post
router.post('/login', authController?.login)

// Function Post New Account
router.post('/register', authController?.registerNewUser)

// Function Reset Password
router.post('/reset-password', authController?.resetPassword)

// Logout
router.post('/logout', authController?.logout)

module.exports = router
