'use strict'
const { isSuperAdmin } = require('../../../utils/tenantScope')

/**
 * Returns the authoritative store for a report query:
 * - super_admin: explicitly requested store from req.storeId (if ?store was passed), or null (global)
 * - non-super_admin: req.storeId ?? req.user?.store ?? null
 * Client-controlled req.cookies.store, req.query.store, and req.body.store are NEVER used for tenant authorization.
 */
function getReportStore(req) {
  if (isSuperAdmin(req)) {
    return req.storeId !== undefined ? req.storeId : null
  }
  return req.storeId ?? req.user?.store ?? null
}

function assertReportStore(req) {
  const store = getReportStore(req)
  if (!store && !isSuperAdmin(req)) {
    const err = new Error('Store assignment required')
    err.statusCode = 403
    throw err
  }
  return store
}

module.exports = { getReportStore, assertReportStore }
