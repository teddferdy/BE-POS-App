const express = require('express')
const router = express.Router()
const expenseCategoryController = require('../controller/expenseCategory')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createExpenseCategorySchema,
  updateExpenseCategorySchema
} = require('../validation/schemas')

router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  expenseCategoryController.getAll
)
router.post(
  '/add',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createExpenseCategorySchema),
  expenseCategoryController.create
)
router.put(
  '/edit/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateExpenseCategorySchema),
  expenseCategoryController.update
)
router.delete(
  '/delete/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  expenseCategoryController.delete
)

module.exports = router
