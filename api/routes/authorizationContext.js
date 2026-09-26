'use strict'

const express = require('express')
const authorization = require('../../utils/authorization')
const { authorizationContextMiddleware } = require('../../utils/authorizationContextMiddleware')
const controller = require('../controller/authorizationContext')

const router = express.Router()

// All context routes require authentication + server-side context resolution.
router.get('/context', authorization, authorizationContextMiddleware, controller.getContext)
router.post('/context/tenant', authorization, authorizationContextMiddleware, controller.selectTenant)
router.post('/context/store', authorization, authorizationContextMiddleware, controller.selectStore)
router.delete('/context', authorization, authorizationContextMiddleware, controller.clearContext)

module.exports = router
