const express = require('express')
const router = express.Router()
const cashRegisterController = require('../controller/cashRegister')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.post('/open', authorization, validateStoreAccess, cashRegisterController.open)
router.put('/close/:id', authorization, validateStoreAccess, cashRegisterController.close)
router.get('/current', authorization, validateStoreAccess, cashRegisterController.getCurrent)
router.get('/history', authorization, validateStoreAccess, cashRegisterController.getHistory)

module.exports = router
