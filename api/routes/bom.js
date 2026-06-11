const express = require('express')
const router = express.Router()
const bomController = require('../controller/bom')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/get-all', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), bomController.getAll)
router.get('/get-by-id/:id', authorization, validateStoreAccess, bomController.getById)
router.post('/add', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), bomController.create)
router.put('/edit/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), bomController.update)
router.delete('/delete/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), bomController.delete)

module.exports = router
