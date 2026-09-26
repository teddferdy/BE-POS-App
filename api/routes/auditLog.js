'use strict'

const express = require('express')
const router = express.Router()
const auditLogController = require('../controller/auditLog')
const authorization = require('../../utils/authorization')
const { authorizationContextMiddleware } = require('../../utils/authorizationContextMiddleware')
const { requireAuditRead } = require('../../utils/auditAuthorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// AUD-3 canonical chain: identity → server-side context → audit.read +
// non-null canonical scope → request-candidate validation → controller.
// Legacy `requireRole` is intentionally gone: JWT roleType/store claims grant
// nothing here. `validateStoreAccess` remains for candidate validation only
// (canonical branch against req.authContext); it is never final authority.
router.get(
  '/',
  authorization,
  authorizationContextMiddleware,
  requireAuditRead,
  validateStoreAccess,
  auditLogController.getAll
)
router.get(
  '/:entity/:entityId',
  authorization,
  authorizationContextMiddleware,
  requireAuditRead,
  validateStoreAccess,
  auditLogController.getByEntity
)

module.exports = router
