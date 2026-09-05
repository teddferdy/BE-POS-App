const express = require('express')
const router = express.Router()
const orderController = require('../controller/order')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createOrderSchema,
  updateOrderStatusSchema,
  updateOrderItemStatusSchema
} = require('../validation/schemas')

// Order CRUD - All authenticated users (POS operations)
router.post(
  '/create',
  authorization,
  validateStoreAccess,
  validate(createOrderSchema),
  orderController.createOrder
)
router.get(
  '/get-orders',
  authorization,
  validateStoreAccess,
  orderController.getOrdersByStore
)
router.get(
  '/get-order/:id',
  authorization,
  validateStoreAccess,
  orderController.getOrderById
)
router.get(
  '/kitchen',
  authorization,
  validateStoreAccess,
  orderController.getKitchenOrders
)
router.put(
  '/update-status',
  authorization,
  validateStoreAccess,
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
)
router.put(
  '/update-item-status',
  authorization,
  validateStoreAccess,
  validate(updateOrderItemStatusSchema),
  orderController.updateOrderItemStatus
)
// Customer-facing (no auth)
router.get('/customer-menu', orderController.getCustomerMenu)
router.get('/customer-member', orderController.getCustomerMember)
router.get('/customer-orders', orderController.getCustomerOrders)
// :token is the order's opaque publicToken (not its database id) —
// required so this unauthenticated route can't be used to enumerate
// other stores' orders. See api/controller/order.js: getCustomerOrder.
router.get('/customer-order/:token', orderController.getCustomerOrder)
router.post('/customer-create', orderController.createCustomerOrder)
router.get('/receipt-html/:token', orderController.getReceiptHTML)
router.get('/customer-tax-rate', orderController.getCustomerTaxRate)
router.get('/customer-reviews', orderController.getProductReviews)
router.post('/customer-review', orderController.createCustomerReview)

module.exports = router
