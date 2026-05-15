const express = require('express')
const router = express.Router()
const supplierController = require('../controller/supplier')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, supplierController.getAll)
router.get('/get-by-id/:id', authorization, supplierController.getById)
router.post('/add', authorization, supplierController.create)
router.put('/edit/:id', authorization, supplierController.update)
router.delete('/delete/:id', authorization, supplierController.delete)

module.exports = router