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
router.post('/add-item', authorization, validateStoreAccess, orderController.addItemToOrder)
router.delete(
  '/remove-item',
  authorization, validateStoreAccess,
  orderController.removeItemFromOrder
)
router.put('/apply-discount', authorization, validateStoreAccess, orderController.applyDiscount)
router.put('/payment', authorization, validateStoreAccess, orderController.payment)

// Void order - Admin & Super Admin only
router.put(
  '/void',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  orderController.voidOrder
)

module.exports = router
