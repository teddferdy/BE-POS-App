const express = require('express')
const router = express.Router()
const stockHistoryController = require('../controller/stockHistory')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/get-all', authorization, validateStoreAccess, stockHistoryController.getAll)
router.get(
  '/get-by-product/:productId',
  authorization, validateStoreAccess,
  stockHistoryController.getByProduct
)
router.get(
  '/get-by-ingredient/:ingredientName',
  authorization, validateStoreAccess,
  stockHistoryController.getByIngredient
)
router.get('/low-stock', authorization, validateStoreAccess, stockHistoryController.getLowStock)
router.get('/low-stock-all', authorization, stockHistoryController.getLowStockAll)

module.exports = router
