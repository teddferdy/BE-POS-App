const express = require('express')
const router = express.Router()
const splitBillController = require('../controller/splitBill')
const authorization = require('../../utils/authorization')

router.post('/create', authorization, splitBillController.create)
router.get('/get-by-order/:orderId', authorization, splitBillController.getByOrder)
router.put('/pay/:id', authorization, splitBillController.pay)
router.delete('/cancel/:id', authorization, splitBillController.cancel)
router.post('/merge', authorization, splitBillController.merge)

module.exports = router