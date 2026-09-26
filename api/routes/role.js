const express = require('express')
const router = express.Router()

const roleController = require('../controller/role')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const { createRoleSchema, updateRoleSchema } = require('../validation/schemas')

// Get All role
router.get('/get-role', roleController.getAllRole)

// Get All List To Table (Super Admin only)
router.get(
  '/get-role-all',
  authorization,
  requireRole('super_admin'),
  roleController.getAllRoleInTable
)

// Add role (Super Admin only)
router.post(
  '/add-new-role',
  authorization,
  requireRole('super_admin'),
  validate(createRoleSchema),
  roleController.addNewRole
)

// Edit role (Super Admin only)
router.put(
  '/edit-role/:id',
  authorization,
  requireRole('super_admin'),
  validate(updateRoleSchema),
  roleController.editRoleById
)

// Delete role (Super Admin only)
router.delete(
  '/delete-role/:id',
  authorization,
  requireRole('super_admin'),
  roleController.deleteRoleById
)

// Get Role by ID
router.get('/get-role-by-id/:id', authorization, roleController.getRoleById)

// Update User Role (Super Admin only)
router.put(
  '/update-user-role',
  authorization,
  requireRole('super_admin'),
  roleController.updateUserRole
)

// Get Users by Role (Super Admin / Admin) — P0-1: a user-management read.
// validateStoreAccess pins an admin to the token's store and rejects foreign
// or unassigned scopes before the controller narrows by store.
router.get(
  '/get-users-by-role',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  roleController.getUsersByRole
)

// Update Access Menu for Role (Super Admin only)
router.put(
  '/update-access-menu',
  authorization,
  requireRole('super_admin'),
  roleController.updateRoleAccessMenu
)

module.exports = router
