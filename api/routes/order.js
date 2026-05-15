const express = require('express')
const router = express.Router()
const orderController = require('../controller/order')
const authorization = require('../../utils/authorization')

router.post('/create', authorization, orderController.createOrder)
router.get('/get-orders', authorization, orderController.getOrdersByStore)
router.get('/get-order/:id', authorization, orderController.getOrderById)
router.get('/kitchen', authorization, orderController.getKitchenOrders)
router.put('/update-status', authorization, orderController.updateOrderStatus)
router.put('/update-item-status', authorization, orderController.updateOrderItemStatus)
router.post('/add-item', authorization, orderController.addItemToOrder)
router.delete('/remove-item', authorization, orderController.removeItemFromOrder)
router.put('/apply-discount', authorization, orderController.applyDiscount)
router.put('/payment', authorization, orderController.payment)
router.put('/void', authorization, orderController.voidOrder)

module.exports = router