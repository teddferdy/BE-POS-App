const express = require('express')
const router = express.Router()
const expenseCategoryController = require('../controller/expenseCategory')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

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
  expenseCategoryController.create
)
router.put(
  '/edit/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
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
