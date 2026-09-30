'use strict'

const express = require('express')
const authorization = require('../../utils/authorization')
const { authorizationContextMiddleware } = require('../../utils/authorizationContextMiddleware')
const controller = require('../controller/membership')

const router = express.Router()

// T-03B canonical chain: identity → server-side context → controller. No
// legacy requireRole / validateStoreAccess: authority is the canonical context.
// `available-roles` is registered before `/:id` so it is never read as an id.
router.get('/available-roles', authorization, authorizationContextMiddleware, controller.availableRoles)
router.get('/', authorization, authorizationContextMiddleware, controller.list)
router.get('/:id', authorization, authorizationContextMiddleware, controller.getById)
router.post('/', authorization, authorizationContextMiddleware, controller.create)
router.patch('/:id', authorization, authorizationContextMiddleware, controller.update)

module.exports = router
