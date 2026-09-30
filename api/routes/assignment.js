'use strict'

const express = require('express')
const authorization = require('../../utils/authorization')
const { authorizationContextMiddleware } = require('../../utils/authorizationContextMiddleware')
const controller = require('../controller/assignment')

const router = express.Router()

// T-03B canonical chain: identity → server-side context → controller.
router.get('/', authorization, authorizationContextMiddleware, controller.list)
router.post('/', authorization, authorizationContextMiddleware, controller.grant)
router.delete('/', authorization, authorizationContextMiddleware, controller.revoke)

module.exports = router
