const express = require('express')
const router = express.Router()
const expenseController = require('../controller/expense')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const { createExpenseSchema, updateExpenseSchema } = require('../validation/schemas')

// Get expenses - All authenticated users
router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  expenseController.getAll
)
router.get(
  '/get-by-id/:id',
  authorization,
  validateStoreAccess,
  expenseController.getById
)
router.get(
  '/get-summary',
  authorization,
  validateStoreAccess,
  expenseController.getSummary
)

// Create/Edit/Delete expense - Admin & Super Admin only
router.post(
  '/add',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createExpenseSchema),
  expenseController.create
)
router.put(
  '/edit/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateExpenseSchema),
  expenseController.update
)
router.delete(
  '/delete/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  expenseController.delete
)

// Approve/Reject - Admin & Super Admin only
router.put(
  '/approve/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  expenseController.approve
)
router.put(
  '/reject/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  expenseController.reject
)

module.exports = router
