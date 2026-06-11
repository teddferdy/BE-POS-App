const express = require('express')
const router = express.Router()
const productionOrderController = require('../controller/productionOrder')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/get-all', authorization, validateStoreAccess, productionOrderController.getAll)
router.get('/get-by-id/:id', authorization, validateStoreAccess, productionOrderController.getById)

router.post(
  '/create',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productionOrderController.create
)
router.put(
  '/update/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productionOrderController.update
)
router.delete(
  '/delete/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productionOrderController.delete
)

router.patch(
  '/status/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productionOrderController.changeStatus
)

router.post(
  '/start/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productionOrderController.startProduction
)

router.post(
  '/complete/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  productionOrderController.completeProduction
)

module.exports = router
