'use strict'

// AUD-3 canonical audit visibility (REPLACE disposition).
//
// Authority comes ONLY from `req.authContext` (server-side session context
// resolved against persisted membership/assignment/lifecycle state) plus
// persisted resource ownership. The following are NEVER authority here:
// JWT role/store claims, req.user.roleType, req.user.store, cookies,
// query/body store or tenant values, frontend-selected store state.
//
// List: canonical scope predicate via auditScopeWhere(); an explicit
// ?store= business filter may only INTERSECT that scope, never expand it.
// Count uses exactly the same predicate as rows.
// Detail: per-row persisted ownership via resolveAuditResourceOwnership() +
// canAccessResource(); unauthorized rows yield a safe empty result
// (200, no existence oracle) and record a DENIED attribution event.

const db = require('../../db/models')
const { canAccessResource } = require('../../utils/authContext')
const {
  auditScopeWhere,
  resolveAuditResourceOwnership,
  narrowAuditStore,
  recordAuditDenial
} = require('../../utils/auditAuthorization')
const { Op } = require('sequelize')

const toPositiveIntOrNull = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

const paginationOf = (page, limit, total) => ({
  total,
  page: parseInt(page, 10),
  limit: parseInt(limit, 10),
  totalPages: Math.ceil(total / parseInt(limit, 10))
})

const userFilters = (query) => {
  const { entity, action, userId, startDate, endDate } = query || {}
  const where = {}
  if (entity) where.entity = entity
  if (action) where.action = action
  if (userId) where.userId = parseInt(userId, 10)
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt[Op.gte] = new Date(startDate)
    if (endDate) where.createdAt[Op.lte] = new Date(`${endDate}T23:59:59`)
  }
  return where
}

// Explicit business store filter (?store= / ?storeId=): intersect-only.
// Ambient cookie state is never consulted. Out-of-scope candidates narrow to
// an empty safe result instead of expanding authority.
const applyStoreNarrowing = async (ctx, query, where) => {
  const candidate = toPositiveIntOrNull(query?.store ?? query?.storeId)
  if (candidate == null) return { where, narrowedEmpty: false }
  const narrowed = await narrowAuditStore(db, ctx, candidate)
  if (narrowed == null) return { where, narrowedEmpty: true }
  return { where: { ...where, store: narrowed }, narrowedEmpty: false }
}

const emptyResult = (res, page = 1, limit = 20) =>
  res.status(200).json({
    success: true,
    message: 'Success get audit logs',
    data: [],
    pagination: paginationOf(page, limit, 0)
  })

const auditLogController = {
  async getAll(req, res) {
    try {
      const ctx = req.authContext
      if (!ctx || ctx.eligible !== true) {
        return res.status(401).json({ message: 'Unauthorized', code: 'INELIGIBLE_ACCOUNT' })
      }
      const { page = 1, limit = 20 } = req.query

      const scopeWhere = await auditScopeWhere(db, ctx)
      const { where, narrowedEmpty } = await applyStoreNarrowing(ctx, req.query, {
        ...scopeWhere,
        ...userFilters(req.query)
      })
      if (narrowedEmpty) return emptyResult(res, page, limit)

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10)
      // Count inherits exactly the same canonical predicate as rows, so
      // pagination metadata cannot leak unauthorized totals.
      const { count, rows } = await db.auditLog.findAndCountAll({
        where,
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success get audit logs',
        data: rows,
        pagination: paginationOf(page, limit, count)
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async getByEntity(req, res) {
    try {
      const ctx = req.authContext
      if (!ctx || ctx.eligible !== true) {
        return res.status(401).json({ message: 'Unauthorized', code: 'INELIGIBLE_ACCOUNT' })
      }
      const { entity, entityId } = req.params
      const { page = 1, limit = 10 } = req.query

      const scopeWhere = await auditScopeWhere(db, ctx)
      const { where, narrowedEmpty } = await applyStoreNarrowing(ctx, req.query, {
        ...scopeWhere,
        entity,
        entityId: parseInt(entityId, 10)
      })
      if (narrowedEmpty) return emptyResult(res, page, limit)

      const candidates = await db.auditLog.findAll({
        where,
        order: [['updatedAt', 'DESC']]
      })

      // Ownership is decided per persisted row (never from request params):
      // conflicting or out-of-scope rows are excluded silently (no oracle).
      const allowed = []
      for (const row of candidates) {
        const ownership = await resolveAuditResourceOwnership(db, row)
        if (ownership.conflict) continue
        if (canAccessResource(ctx, 'audit.read', ownership)) allowed.push(row)
      }
      if (candidates.length > 0 && allowed.length === 0) {
        await recordAuditDenial(req, ctx, 'FOREIGN_RESOURCE')
      }

      const total = allowed.length
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10)
      const data = allowed.slice(offset, offset + parseInt(limit, 10))

      return res.status(200).json({
        success: true,
        message: 'Success get audit logs',
        data,
        pagination: paginationOf(page, limit, total)
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = auditLogController
