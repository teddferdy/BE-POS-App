'use strict'

/**
 * Phase 30F-1 — shared default-deny guard for destructive DB scripts.
 *
 * Pure module: no DB connection, no model init, no credential logging.
 * Scripts must call the guard BEFORE requiring db/models / authenticating.
 */

const DESTRUCTIVE_CONFIRM_VALUE = 'I_UNDERSTAND_THIS_WIPES_PROD'

const SAFE_NON_PROD_ENVS = new Set(['development', 'test'])

function parseForceFlag(argv) {
  return Array.isArray(argv) && argv.includes('--force')
}

function isProductionLike({ nodeEnv, host, database } = {}) {
  if (nodeEnv === 'production') return true
  if (database === 'neondb') return true
  const h = typeof host === 'string' ? host : ''
  if (h.includes('neon.tech')) return true
  if (h.startsWith('ep-')) return true
  return false
}

function refusalError(operation, reason) {
  return new Error(
    `[destructive-guard] REFUSED ${operation}: ${reason}. ` +
      `Destructive production sync is default-deny. ` +
      `Set ALLOW_DESTRUCTIVE_SYNC=${DESTRUCTIVE_CONFIRM_VALUE} AND pass --force to proceed.`
  )
}

function assertDestructiveAllowed({
  operation = 'destructive-operation',
  nodeEnv,
  host,
  database,
  allowVar,
  hasForceFlag = false
} = {}) {
  // 1. Production-like target → require BOTH explicit confirmation AND --force.
  if (isProductionLike({ nodeEnv, host, database })) {
    if (allowVar !== DESTRUCTIVE_CONFIRM_VALUE) {
      throw refusalError(
        operation,
        'production-like target detected and destructive confirmation missing or incorrect'
      )
    }
    if (!hasForceFlag) {
      throw refusalError(
        operation,
        'production-like target detected and explicit --force flag missing'
      )
    }
    return { allowed: true, productionLike: true }
  }

  // 2. Fail closed on unknown env / unresolvable identity.
  if (!SAFE_NON_PROD_ENVS.has(nodeEnv)) {
    throw refusalError(
      operation,
      'environment is not an explicitly safe non-production env (expected development/test)'
    )
  }

  // 3. Even for safe non-prod destructive ops, require explicit --force.
  if (!hasForceFlag) {
    throw refusalError(
      operation,
      'explicit --force flag missing (destructive ops are never implicit)'
    )
  }

  return { allowed: true, productionLike: false }
}

module.exports = {
  DESTRUCTIVE_CONFIRM_VALUE,
  SAFE_NON_PROD_ENVS,
  parseForceFlag,
  isProductionLike,
  assertDestructiveAllowed
}
