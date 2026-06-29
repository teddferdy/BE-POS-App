const express = require('express')
const router = express.Router()
const exportMasterController = require('../controller/exportMaster')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get(
  '/master-data',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  exportMasterController.exportAll
)

module.exports = router
