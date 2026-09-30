'use strict'

// T-03B — canonical membership HTTP API over the T-03A service.
//
//   GET    /memberships/available-roles  canonical roles the actor may grant (UX only)
//   GET    /memberships                  memberships visible to the actor
//   GET    /memberships/:id              one visible membership
//   POST   /memberships                  create / reactivate (T-03A D3/D16)
//   PATCH  /memberships/:id              exactly one of: status | role | toTenantId
//
// The actor always comes from req.authContext (utils/canonicalHttp.actorFrom);
// every mutation re-authorizes in the T-03A service. This is the canonical
// membership system only — it does not replace the legacy role table
// (/role/*, Add Role, Add/Edit Employee).
//
// L2 boundary: a membership deactivation, move or downgrade revokes the
// sessions that membership authorized (T-03A D5-B), but legacy routes still
// authorize from the account's roleType/store, so it does NOT remove
// legacy-route access. Full access removal is account disablement.

const service = require('../service/membershipAssignmentService')
const visibility = require('../service/scopeVisibilityService')
const { actorFrom, ok, okPage, sendError } = require('../../utils/canonicalHttp')

const ROLE_NAMES = Object.freeze({
  platform_admin: 'Platform Admin',
  tenant_admin: 'Tenant Admin',
  store_admin: 'Store Admin',
  cashier: 'Cashier',
  staff: 'Staff'
})

const STATUS_OPERATIONS = Object.freeze({
  DEACTIVATED: 'deactivate',
  ACTIVE: 'reactivate',
  RETIRED: 'retire'
})

const invalidOperation = () =>
  service.fail('INVALID_OPERATION', 'status', 'exactly one of status, role or toTenantId is required')

// PATCH body → one T-03A operation. `role` alongside `toTenantId` is the
// move's target role (T-03A D4); otherwise status/role/move are exclusive.
const parseOperation = (body) => {
  const hasStatus = body.status !== undefined
  const hasRole = body.role !== undefined
  const hasMove = body.toTenantId !== undefined
  if (hasMove) {
    if (hasStatus) throw invalidOperation()
    return { kind: 'move' }
  }
  if (hasStatus === hasRole) throw invalidOperation()
  if (hasRole) return { kind: 'role' }
  const kind = STATUS_OPERATIONS[body.status]
  if (!kind) throw invalidOperation()
  return { kind }
}

exports.availableRoles = (req, res) => {
  const roles = service.grantableRoles(req.authContext?.activeRole)
  if (roles.length === 0) {
    return sendError(res, service.fail('FORBIDDEN', 'actor', 'actor may not grant membership roles'))
  }
  return ok(res, { roles: roles.map((code) => ({ code, name: ROLE_NAMES[code] })) })
}

exports.list = async (req, res) => {
  try {
    const viewer = visibility.viewerOf(req.authContext)
    return okPage(res, await visibility.listMemberships(viewer, Number(req.user.id), req.query || {}))
  } catch (err) {
    return sendError(res, err)
  }
}

// Resolves :id to a membership row the actor may see. Self-only actors get
// 403 for anything that is not their own row — target-independent, so it
// never reveals whether another membership exists.
//
// OD-1(a): PATCH is a platform mutation, not a read. A platform_admin remains
// globally authoritative even with a tenant selected, so the update path
// passes { forPlatformMutation: true } and resolves platform-wide
// ({ kind: 'platform' }). Reads (getById/list) never pass the flag and keep
// D8 visibility. Unknown ids still yield the generic 404 below.
const visibleMembershipOrFail = async (req, { forPlatformMutation = false } = {}) => {
  const viewer = visibility.viewerOf(req.authContext)
  const isPlatformActor = req.authContext?.activeRole === 'platform_admin'
  const effectiveViewer = forPlatformMutation && isPlatformActor ? { kind: 'platform' } : viewer
  const selfId = Number(req.user.id)
  let id = null
  try {
    id = service.toId(req.params.id, 'RESOURCE_NOT_FOUND', 'id', 'membership')
  } catch (err) {
    if (effectiveViewer.kind === 'self') throw service.fail('FORBIDDEN', 'id', 'actor may only access its own memberships')
    throw err
  }
  const row = await visibility.findVisibleMembership(effectiveViewer, selfId, id)
  if (!row) {
    if (effectiveViewer.kind === 'self') throw service.fail('FORBIDDEN', 'id', 'actor may only access its own memberships')
    throw service.notFound('id')
  }
  return row
}

exports.getById = async (req, res) => {
  try {
    const row = await visibleMembershipOrFail(req)
    return ok(res, { id: row.id, userId: row.userId, tenantId: row.tenantId, role: row.role, status: row.status })
  } catch (err) {
    return sendError(res, err)
  }
}

exports.create = async (req, res) => {
  const actor = actorFrom(req)
  try {
    const body = req.body || {}
    const result = await service.createMembership({
      actor,
      targetUserId: body.userId,
      tenantId: body.tenantId !== undefined ? body.tenantId : actor.tenantId,
      role: body.role,
      reason: body.reason,
      requestId: body.requestId
    })
    return ok(res, result, result.created ? 201 : 200)
  } catch (err) {
    return sendError(res, err, { actorRole: actor.role })
  }
}

exports.update = async (req, res) => {
  const actor = actorFrom(req)
  try {
    const body = req.body || {}
    const operation = parseOperation(body)
    const row = await visibleMembershipOrFail(req, { forPlatformMutation: true })
    const target = { actor, targetUserId: row.userId, reason: body.reason, requestId: body.requestId }
    let result
    if (operation.kind === 'deactivate') {
      result = await service.deactivateMembership({ ...target, tenantId: row.tenantId })
    } else if (operation.kind === 'reactivate') {
      result = await service.reactivateMembership({ ...target, tenantId: row.tenantId })
    } else if (operation.kind === 'retire') {
      result = await service.retireMembership({ ...target, tenantId: row.tenantId })
    } else if (operation.kind === 'role') {
      result = await service.changeMembershipRole({ ...target, tenantId: row.tenantId, role: body.role })
    } else {
      result = await service.moveMembership({
        ...target,
        fromTenantId: row.tenantId,
        toTenantId: body.toTenantId,
        role: body.role
      })
    }
    return ok(res, result)
  } catch (err) {
    return sendError(res, err, { actorRole: actor.role })
  }
}
