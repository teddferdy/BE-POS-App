const express = require('express')
const router = express.Router()
const ingredientController = require('../controller/ingredient')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/get-all', authorization, validateStoreAccess, ingredientController.getAll)
router.get('/get-by-id/:id', authorization, validateStoreAccess, ingredientController.getById)
router.post('/add', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), ingredientController.create)
router.put('/edit/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), ingredientController.update)
router.put('/adjust-stock/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), ingredientController.adjustStock)
router.delete('/delete/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), ingredientController.delete)

module.exports = router
