const express = require('express')
const router = express.Router()
const priceListTemplateController = require('../controller/priceListTemplate')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get templates - All authenticated users
router.get('/', authorization, priceListTemplateController.getAll)
router.get('/get-price-list-template/:id', authorization, priceListTemplateController.getById)

// Create/Edit/Delete - Admin & Super Admin only
router.post(
  '/add-new-price-list-template',
  requireRole('super_admin', 'admin'),
  priceListTemplateController.create
)
router.put(
  '/edit-price-list-template/:id',
  requireRole('super_admin', 'admin'),
  priceListTemplateController.update
)
router.delete(
  '/delete-price-list-template/:id',
  requireRole('super_admin', 'admin'),
  priceListTemplateController.delete
)

module.exports = router
