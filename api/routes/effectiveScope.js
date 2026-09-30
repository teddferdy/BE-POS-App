'use strict'

const express = require('express')
const authorization = require('../../utils/authorization')
const { authorizationContextMiddleware } = require('../../utils/authorizationContextMiddleware')
const controller = require('../controller/effectiveScope')

const router = express.Router()

// T-03B D8: identity → server-side context (with reactivation freshness) → controller.
router.get('/', authorization, authorizationContextMiddleware, controller.get)

module.exports = router
