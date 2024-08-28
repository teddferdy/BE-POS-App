const express = require('express')
// Contollers
const authController = require('../controller/auth')

const authorization = require('../../utils/authorization')

const router = express.Router()

// Form Login
router.get('/get-all-user', authorization, authController?.getAllUser)

// Login Post
router.post('/login', authController?.login)

// Function Post New Account
router.post('/register', authController?.registerNewUser)

// Function Reset Password
router.post('/reset-password', authController?.resetPassword)

// Function Edit User
router.put('/edit-user/:id', authController?.editUser)

// Logout
router.post('/logout/:id', authController?.logout)

module.exports = router
