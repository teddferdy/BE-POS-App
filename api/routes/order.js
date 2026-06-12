const express = require('express')
const router = express.Router()
const orderController = require('../controller/order')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Order CRUD - All authenticated users (POS operations)
router.post('/create', authorization, validateStoreAccess, orderController.createOrder)
router.get('/get-orders', authorization, validateStoreAccess, orderController.getOrdersByStore)
router.get('/get-order/:id', authorization, validateStoreAccess, orderController.getOrderById)
router.get('/kitchen', authorization, validateStoreAccess, orderController.getKitchenOrders)
router.put('/update-status', authorization, validateStoreAccess, orderController.updateOrderStatus)
router.put(
  '/update-item-status',
  authorization, validateStoreAccess,
  orderController.updateOrderItemStatus
)
// Customer-facing (no auth)
router.get('/customer-menu', orderController.getCustomerMenu)
router.post('/customer-create', orderController.createCustomerOrder)

module.exports = router
