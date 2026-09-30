'use strict'

// T-03B — canonical store-assignment HTTP API over the T-03A service.
//
//   GET    /assignments   assignments visible to the actor
//   POST   /assignments   { userId, storeId, reason?, requestId? } — grant (idempotent)
//   DELETE /assignments   { userId, storeId, reason, requestId? } — revoke (hard delete)
//
// The actor always comes from req.authContext; the T-03A service enforces the
// D6 target-role ceiling and D14 ordering. For a store_admin, a target ranked
// at or above store_admin is invisible (D8), so its ROLE_CEILING is answered
// as RESOURCE_NOT_FOUND by canonicalHttp.sendError.
//
// L2 boundary: revoking an assignment revokes the sessions that selected the
// store (T-03A); it does not change legacy-route access.

const service = require('../service/membershipAssignmentService')
const visibility = require('../service/scopeVisibilityService')
const { actorFrom, ok, okPage, sendError } = require('../../utils/canonicalHttp')

exports.list = async (req, res) => {
  try {
    const viewer = visibility.viewerOf(req.authContext)
    return okPage(res, await visibility.listAssignments(viewer, Number(req.user.id), req.query || {}))
  } catch (err) {
    return sendError(res, err)
  }
}

exports.grant = async (req, res) => {
  const actor = actorFrom(req)
  try {
    const body = req.body || {}
    const result = await service.grantAssignment({
      actor,
      targetUserId: body.userId,
      storeId: body.storeId,
      reason: body.reason,
      requestId: body.requestId
    })
    return ok(res, result, result.created ? 201 : 200)
  } catch (err) {
    return sendError(res, err, { actorRole: actor.role })
  }
}

exports.revoke = async (req, res) => {
  const actor = actorFrom(req)
  try {
    const body = req.body || {}
    const result = await service.revokeAssignment({
      actor,
      targetUserId: body.userId,
      storeId: body.storeId,
      reason: body.reason,
      requestId: body.requestId
    })
    return ok(res, result)
  } catch (err) {
    return sendError(res, err, { actorRole: actor.role })
  }
}
