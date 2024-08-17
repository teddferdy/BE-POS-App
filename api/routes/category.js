const express = require('express')
const router = express.Router()

// Controller
const categoryController = require('../controller/category')

// Authorization
const authorization = require('../../utils/authorization')

// Get All List Category
router.get('/get-category', authorization, categoryController?.getAllCategory)

// Add New Category
router.post(
  '/add-new-category',
  authorization,
  categoryController?.addNewCategory
)

// Edit Category
router.post(
  '/edit-category/:id',
  authorization,
  categoryController?.editCategoryById
)

// Delete Category
router.delete(
  '/delete-category/:id',
  authorization,
  categoryController?.deleteCategoryById
)

module.exports = router
