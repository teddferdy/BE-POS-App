const express = require('express')
const router = express.Router()
const expenseCategoryController = require('../controller/expenseCategory')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, expenseCategoryController.getAll)
router.post('/add', authorization, expenseCategoryController.create)
router.put('/edit/:id', authorization, expenseCategoryController.update)
router.delete('/delete/:id', authorization, expenseCategoryController.delete)

module.exports = router