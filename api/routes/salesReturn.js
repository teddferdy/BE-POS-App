const express = require('express')
const router = express.Router()
const salesReturnController = require('../controller/salesReturn')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/get-all', authorization, validateStoreAccess, salesReturnController.getAll)
router.get('/get-by-id/:id', authorization, validateStoreAccess, salesReturnController.getById)

router.patch(
  '/approve/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  salesReturnController.approve
)
router.patch(
  '/reject/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  salesReturnController.reject
)

module.exports = router
