'use strict'

// T-03B D8 — GET /effective-scope[?userId=]
//
// Omitted userId, or the caller's own id, is the self view. Any other id is a
// target lookup decided by scopeVisibilityService: invisible and nonexistent
// targets return the same 404; self-only actors (cashier, staff, no context)
// get 403 for every other id regardless of whether it exists.

const service = require('../service/membershipAssignmentService')
const visibility = require('../service/scopeVisibilityService')
const { ok, sendError } = require('../../utils/canonicalHttp')

const idOrNull = (value) => {
  try {
    return service.toId(value, 'RESOURCE_NOT_FOUND', 'userId', 'user')
  } catch {
    return null
  }
}

exports.get = async (req, res) => {
  try {
    const selfId = Number(req.user.id)
    const raw = req.query?.userId
    const requested = raw === undefined ? selfId : idOrNull(raw)
    if (requested === selfId) {
      return ok(res, await visibility.buildSelfScope({ user: req.user, ctx: req.authContext, session: req.authSession }))
    }
    const viewer = visibility.viewerOf(req.authContext)
    if (viewer.kind === 'self') {
      return sendError(res, service.fail('FORBIDDEN', 'userId', 'actor may only view its own scope'))
    }
    if (requested == null) return sendError(res, service.notFound('userId'))
    const target = await visibility.findVisibleTarget(viewer, requested)
    if (!target) return sendError(res, service.notFound('userId'))
    return ok(res, await visibility.buildTargetScope(viewer, target))
  } catch (err) {
    return sendError(res, err)
  }
}
