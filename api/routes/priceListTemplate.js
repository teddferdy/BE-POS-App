const express = require('express')
const router = express.Router()
const priceListTemplateController = require('../controller/priceListTemplate')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Get templates - All authenticated users
router.get('/', authorization, validateStoreAccess, priceListTemplateController.getAll)
router.get('/get-price-list-template/:id', authorization, validateStoreAccess, priceListTemplateController.getById)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/add-new-price-list-template',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  priceListTemplateController.create
)
router.put(
  '/edit-price-list-template/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  priceListTemplateController.update
)
router.delete(
  '/delete-price-list-template/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  priceListTemplateController.delete
)

module.exports = router
