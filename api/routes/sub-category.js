const express = require('express')

const router = express.Router()

// Authorization
const authorization = require('../../utils/authorization')

const controllerSubCategory = require('../controller/sub-category')

// Get All Sub Category
router.get(
  '/get-all-sub-category',
  authorization,
  controllerSubCategory?.getAllSubCategory
)

// Adding Option By Id Product
router.post(
  '/add-subcategory',
  authorization,
  controllerSubCategory?.postNewSubCategory
)

// Get Sub Category By idCategory
router.get(
  '/get-subcategory/:id',
  authorization,
  controllerSubCategory?.getSubcategoryById
)

// Edit Location
router.put(
  '/edit-subcategory/:id',
  authorization,
  controllerSubCategory?.editSubcategoryById
)

// Delete Location
router.delete(
  '/delete-subcategory/:id',
  authorization,
  controllerSubCategory?.deleteSubcategoryById
)

module.exports = router
