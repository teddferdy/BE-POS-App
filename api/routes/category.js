const express = require('express')
const router = express.Router()

const categoryController = require('../controller/category')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get All List Category - All authenticated users
router.get('/get-category', authorization, categoryController.getAllCategory)

// Get All List To Table
router.get(
  '/get-category-all',
  authorization,
  categoryController.getAllCategoryInTable
)

// Add New Category - Admin & Super Admin only
router.post(
  '/add-new-category',
  requireRole('super_admin', 'admin'),
  categoryController.addNewCategory
)

// Edit Category - Admin & Super Admin only
router.put(
  '/edit-category/:id',
  requireRole('super_admin', 'admin'),
  categoryController.editCategoryById
)

// Delete Category - Admin & Super Admin only
router.delete(
  '/delete-category/:id',
  requireRole('super_admin', 'admin'),
  categoryController.deleteCategoryById
)

// Download Excel - Admin & Super Admin only
router.get(
  '/download-excel',
  requireRole('super_admin', 'admin'),
  categoryController.exportCategory
)

module.exports = router
