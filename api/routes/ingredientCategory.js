const express = require('express')
const router = express.Router()
const ingredientCategoryController = require('../controller/ingredientCategory')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/get-all', authorization, validateStoreAccess, ingredientCategoryController.getAll)
router.get('/get-by-id/:id', authorization, validateStoreAccess, ingredientCategoryController.getById)
router.post('/add', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), ingredientCategoryController.create)
router.put('/edit/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), ingredientCategoryController.update)
router.delete('/delete/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), ingredientCategoryController.delete)

module.exports = router
