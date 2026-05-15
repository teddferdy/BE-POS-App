const express = require('express')
const router = express.Router()
const purchaseOrderController = require('../controller/purchaseOrder')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, purchaseOrderController.getAll)
router.get('/get-by-id/:id', authorization, purchaseOrderController.getById)
router.post('/create', authorization, purchaseOrderController.create)
router.put('/update/:id', authorization, purchaseOrderController.update)
router.put('/receive/:id', authorization, purchaseOrderController.receive)
router.put('/cancel/:id', authorization, purchaseOrderController.cancel)
router.delete('/delete/:id', authorization, purchaseOrderController.delete)

module.exports = router