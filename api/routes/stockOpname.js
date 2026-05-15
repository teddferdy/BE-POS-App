const express = require('express')
const router = express.Router()
const stockOpnameController = require('../controller/stockOpname')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, stockOpnameController.getAll)
router.get('/get-by-id/:id', authorization, stockOpnameController.getById)
router.post('/create', authorization, stockOpnameController.create)
router.put('/update/:id', authorization, stockOpnameController.update)
router.put('/complete/:id', authorization, stockOpnameController.complete)
router.put('/cancel/:id', authorization, stockOpnameController.cancel)
router.delete('/delete/:id', authorization, stockOpnameController.delete)

module.exports = router