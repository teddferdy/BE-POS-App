const express = require('express')
const router = express.Router()
const splitBillController = require('../controller/splitBill')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.post('/create', authorization, validateStoreAccess, splitBillController.create)
router.get(
  '/get-by-order/:orderId',
  authorization, validateStoreAccess,
  splitBillController.getByOrder
)
router.put('/pay/:id', authorization, validateStoreAccess, splitBillController.pay)
router.delete('/cancel/:id', authorization, validateStoreAccess, splitBillController.cancel)
router.post('/merge', authorization, validateStoreAccess, splitBillController.merge)

module.exports = router
