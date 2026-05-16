const express = require('express')
const router = express.Router()

const roleController = require('../controller/role')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get All role
router.get('/get-role', roleController.getAllRole)

// Get All List To Table (Super Admin only)
router.get('/get-role-all', requireRole('super_admin'), roleController.getAllRoleInTable)

// Add role (Super Admin only)
router.post('/add-new-role', requireRole('super_admin'), roleController.addNewRole)

// Edit role (Super Admin only)
router.put('/edit-role/:id', requireRole('super_admin'), roleController.editRoleById)

// Delete role (Super Admin only)
router.delete('/delete-role/:id', requireRole('super_admin'), roleController.deleteRoleById)

// Get Role by ID
router.get('/get-role-by-id/:id', authorization, roleController.getRoleById)

// Update User Role (Super Admin only)
router.put('/update-user-role', requireRole('super_admin'), roleController.updateUserRole)

// Get Users by Role
router.get('/get-users-by-role', authorization, roleController.getUsersByRole)

// Update Access Menu for Role (Super Admin only)
router.put('/update-access-menu', requireRole('super_admin'), roleController.updateRoleAccessMenu)

module.exports = router
