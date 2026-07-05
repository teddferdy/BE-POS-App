const express = require('express')
const router = express.Router()

const memberController = require('../controller/member')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validate } = require('../middleware/validate')
const { createMemberSchema, updateMemberSchema } = require('../validation/schemas')

// Get Members - All authenticated users
router.get('/get-member', authorization, memberController.getAllMember)
router.get('/get-member/:id', authorization, memberController.getMemberById)

// Add Member - Admin & Super Admin only
router.post(
  '/add-new-member',
  authorization,
  requireRole('super_admin', 'admin'),
  validate(createMemberSchema),
  memberController.addNewMember
)

// Edit Member - Admin & Super Admin only
router.put(
  '/edit-member/:id',
  authorization,
  requireRole('super_admin', 'admin'),
  validate(updateMemberSchema),
  memberController.editMember
)

// Delete Member - Admin & Super Admin only
router.delete(
  '/delete-member/:id',
  authorization,
  requireRole('super_admin', 'admin'),
  memberController.deleteMember
)

// Edit Member Point - Admin & Super Admin only (keep for backward compatibility)
router.put(
  '/edit-point-member/:phoneNumber',
  authorization,
  requireRole('super_admin', 'admin'),
  memberController.editMemberById
)

module.exports = router
