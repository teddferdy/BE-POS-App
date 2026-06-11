const express = require('express')
const router = express.Router()
const cashRegisterController = require('../controller/cashRegister')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.post('/open', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), cashRegisterController.open)
router.put('/close/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), cashRegisterController.close)
router.get('/current', authorization, validateStoreAccess, cashRegisterController.getCurrent)
router.get('/history', authorization, validateStoreAccess, cashRegisterController.getHistory)

module.exports = router
