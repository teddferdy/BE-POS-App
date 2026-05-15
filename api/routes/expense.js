const express = require('express')
const router = express.Router()
const expenseController = require('../controller/expense')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, expenseController.getAll)
router.get('/get-by-id/:id', authorization, expenseController.getById)
router.get('/get-summary', authorization, expenseController.getSummary)
router.post('/add', authorization, expenseController.create)
router.put('/edit/:id', authorization, expenseController.update)
router.put('/approve/:id', authorization, expenseController.approve)
router.put('/reject/:id', authorization, expenseController.reject)
router.delete('/delete/:id', authorization, expenseController.delete)

module.exports = router