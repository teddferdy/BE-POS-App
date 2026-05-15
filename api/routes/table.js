const express = require('express')
const router = express.Router()
const tableController = require('../controller/table')
const authorization = require('../../utils/authorization')

router.get('/get-tables', authorization, tableController.getTablesByStore)
router.get('/get-tables-with-orders', authorization, tableController.getTableWithActiveOrders)
router.get('/get-availability', authorization, tableController.getTableAvailability)
router.post('/create', authorization, tableController.createTable)
router.put('/update', authorization, tableController.updateTable)
router.delete('/delete/:id', authorization, tableController.deleteTable)
router.put('/update-status', authorization, tableController.updateTableStatus)

module.exports = router