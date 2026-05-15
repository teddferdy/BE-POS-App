const express = require('express')
const router = express.Router()
const ingredientController = require('../controller/ingredient')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, ingredientController.getAll)
router.get('/get-by-id/:id', authorization, ingredientController.getById)
router.post('/add', authorization, ingredientController.create)
router.put('/edit/:id', authorization, ingredientController.update)
router.put('/adjust-stock/:id', authorization, ingredientController.adjustStock)
router.delete('/delete/:id', authorization, ingredientController.delete)

module.exports = router