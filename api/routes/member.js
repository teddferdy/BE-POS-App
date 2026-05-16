const express = require('express')
const router = express.Router()

const memberController = require('../controller/member')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get Members - All authenticated users
router.get('/get-member', authorization, memberController.getAllMember)

// Add Member - Admin & Super Admin only
router.post('/add-new-member', requireRole('super_admin', 'admin'), memberController.addNewMember)

// Edit Member Point - Admin & Super Admin only
router.put('/edit-point-member/:phoneNumber', requireRole('super_admin', 'admin'), memberController.editMemberById)

module.exports = router
