const express = require('express')
const router = express.Router()
const cashRegisterController = require('../controller/cashRegister')
const authorization = require('../../utils/authorization')

router.post('/open', authorization, cashRegisterController.open)
router.put('/close/:id', authorization, cashRegisterController.close)
router.get('/current', authorization, cashRegisterController.getCurrent)
router.get('/history', authorization, cashRegisterController.getHistory)

module.exports = router