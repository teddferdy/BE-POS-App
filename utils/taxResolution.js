'use strict'

// P1: single source of truth for effective-tax row resolution, shared by
// checkout (order.js) and the read-only effective-tax summary
// (taxConfig.js getEffective). The WHERE clauses below are the exact
// checkout rules — store-or-global scope, active status, per-type filter,
// soft-deleted rows excluded by the model's paranoid default. This helper
// performs no summation, no error mapping, and no writes; each caller keeps
// its own established semantics (missing-PPN setup error, empty-service
// means 0) on top of the same rows so display can never drift from charge.

const db = require('../db/models')
const { Op } = require('sequelize')

// Active rows contributing to the effective rate for a store scope.
// `store` is a numeric outlet id, or null/undefined for the global-only
// scope (store-null rows). Returns plain row objects.
async function fetchActiveTaxRows(store) {
  const scopeFilter =
    store === null || store === undefined
      ? { store: null }
      : { [Op.or]: [{ store }, { store: null }] }
  const [ppn, serviceCharge] = await Promise.all([
    db.taxConfig.findAll({
      where: { ...scopeFilter, type: 'ppn', status: 'active' },
      attributes: ['id', 'name', 'rate', 'store'],
      order: [['id', 'ASC']]
    }),
    db.taxConfig.findAll({
      where: { ...scopeFilter, type: 'service_charge', status: 'active' },
      attributes: ['id', 'name', 'rate', 'store'],
      order: [['id', 'ASC']]
    })
  ])
  return {
    ppn: ppn.map((r) => r.get({ plain: true })),
    serviceCharge: serviceCharge.map((r) => r.get({ plain: true }))
  }
}

module.exports = {
  fetchActiveTaxRows
}
