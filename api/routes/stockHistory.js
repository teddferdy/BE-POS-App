const express = require('express')
const router = express.Router()
const stockHistoryController = require('../controller/stockHistory')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, stockHistoryController.getAll)
router.get('/get-by-product/:productId', authorization, stockHistoryController.getByProduct)
router.get('/get-by-ingredient/:ingredientName', authorization, stockHistoryController.getByIngredient)
router.get('/low-stock', authorization, stockHistoryController.getLowStock)

module.exports = router