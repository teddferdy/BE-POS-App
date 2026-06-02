const express = require('express')
const router = express.Router()
const auditLogController = require('../controller/auditLog')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/', authorization, validateStoreAccess, requireRole('super_admin'), auditLogController.getAll)
router.get('/:entity/:entityId', authorization, validateStoreAccess, requireRole('super_admin'), auditLogController.getByEntity)

module.exports = router
