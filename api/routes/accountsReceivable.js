const express = require('express')
const router = express.Router()
const arController = require('../controller/accountsReceivable')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/list', authorization, validateStoreAccess, arController.list)
router.get('/aging', authorization, validateStoreAccess, arController.agingReport)
router.get('/:id', authorization, validateStoreAccess, arController.getById)
router.post('/create', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), arController.create)
router.post('/:id/pay', authorization, validateStoreAccess, arController.recordPayment)
router.put('/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), arController.update)
router.delete('/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), arController.delete)

module.exports = router
