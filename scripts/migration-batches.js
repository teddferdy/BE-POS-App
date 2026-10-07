'use strict'

/**
 * D-08 E2 Option C — bounded migration batch contract.
 *
 * The E2 inventory (migrations meant to run through the normal runner; see
 * db/migration-dispositions/README.md) is executed in separately approved,
 * contiguous batches instead of one unbounded `db:migrate`:
 *
 *   B1  the original 13 E2 migrations (includes 20261011000001, whose effect
 *       already exists in production via D-08-EXC-01; its guard makes it a
 *       no-op and the runner records it normally)
 *   B2  P1 foundation: M1 attribution, M2 linkage FKs, M5 close snapshot
 *   B3  M3 canonical typePayment CHECK — only after P1 code is live and
 *       canonical payment writes are verified (a5deb07 writes non-canonical
 *       values such as 'cash', which the CHECK would refuse)
 *
 * Record: docs/superpowers/evidence/d08-e2-batch-contract-record.md.
 *
 * This module is a pure decision. It never connects to a database and never
 * writes SequelizeMeta; scripts/run-migrations.js consumes it after the D-08
 * preflight (scripts/check-migration-preflight.js) has passed. Batch members
 * are exact filenames — there is no free-form range and no arbitrary
 * filename execution.
 *
 * openGates are governance gates the runner refuses on. Clearing one is a
 * reviewed change to this file that cites the decision/evidence; existing in
 * the repository never approves a batch for execution on its own.
 */

const deepFreeze = (batch) =>
  Object.freeze({
    ...batch,
    migrations: Object.freeze([...batch.migrations]),
    openGates: Object.freeze(batch.openGates.map((g) => Object.freeze({ ...g })))
  })

const E2_BATCHES = Object.freeze({
  B1: deepFreeze({
    id: 'B1',
    title: 'Original E2 #1–#13',
    expectedCount: 13,
    migrations: [
      '20260613000003-insert-default-roles.js',
      '20260810000002-add-goods-request-menu-access.js',
      '20260827000004-add-my-shift-access-menu.js',
      '20260902000002-add-business-trip-menu-access.js',
      '20261001000001-purchase-monetary-bigint.js',
      '20261001000002-goods-receipt-item-qty-decimal.js',
      '20261001000003-goods-receipt-idempotency.js',
      '20261002000001-fractional-stock-decimal.js',
      '20261004000001-stock-opname-decimal.js',
      '20261006000001-stock-transfer-idempotency-decimal.js',
      '20261007000001-add-dr20-foundation-fields-to-audit-log.js',
      '20261011000001-add-reactivated-at-to-tenant-membership.js',
      '20261012000001-d05-member-identity-uniqueness.js'
    ],
    // DR-22: RESOLVED 2026-10-07 by Product Owner CONDITIONAL AUTHORIZATION
    // (docs/superpowers/evidence/dr22-conditional-authorization-record.md;
    // intent dr22-condition1-intent-record-2026-10-07.md; role-state
    // dr22-condition-recapture-2026-10-07T18-14-37Z.md). Gate clearance makes
    // B1 governance-eligible only: B1 execution still needs its own explicit
    // approval plus, per the D-08 record and RELEASING.md, an execution-time
    // restore point and fresh read-only preconditions.
    openGates: []
  }),
  B2: deepFreeze({
    id: 'B2',
    title: 'P1 foundation: M1 + M2 + M5',
    expectedCount: 3,
    migrations: [
      '20261013000001-p1-transaction-attribution.js',
      '20261013000002-p1-transaction-linkage-fks.js',
      '20261013000004-p1-register-close-snapshot.js'
    ],
    openGates: []
  }),
  B3: deepFreeze({
    id: 'B3',
    title: 'P1 M3 canonical payment CHECK',
    expectedCount: 1,
    migrations: ['20261013000005-p1-canonical-payment-check.js'],
    openGates: [
      {
        id: 'P1-CANONICAL-WRITES-VERIFIED',
        reason:
          'M3 refuses non-canonical typePayment writes; it may run only after P1 code is live in production and canonical payment writes are verified'
      }
    ]
  })
})

const BATCH_ORDER = Object.freeze(['B1', 'B2', 'B3'])

function validateBatchDefinition(batch) {
  const errors = []
  const list = Array.isArray(batch?.migrations) ? batch.migrations : []
  if (list.length === 0) errors.push('contract lists no migrations')
  if (list.some((m) => typeof m !== 'string' || !m.endsWith('.js'))) errors.push('contract entries must be migration filenames')
  for (let i = 1; i < list.length; i++) {
    if (!(list[i - 1] < list[i])) {
      errors.push(`contract is not strictly ascending in filename order at ${list[i - 1]} → ${list[i]}`)
      break
    }
  }
  if (batch?.expectedCount !== list.length) {
    errors.push(`expected ${batch?.expectedCount} migrations, contract lists ${list.length}`)
  }
  return errors
}

// Decides whether `sequelize-cli db:migrate --to <to>` would execute exactly
// this batch: every member exists, none is recorded yet, the pending list
// (files − SequelizeMeta, filename order) starts with exactly these members,
// and no governance gate is open.
function evaluateBatch({ batchId, files, metaNames, batches = E2_BATCHES }) {
  const batch = Object.prototype.hasOwnProperty.call(batches, batchId) ? batches[batchId] : null
  if (!batch) return { ok: false, reasons: [`unknown batch "${batchId}" (known: ${Object.keys(batches).join(', ')})`] }
  const reasons = validateBatchDefinition(batch).map((e) => `batch ${batchId}: ${e}`)
  if (!Array.isArray(files) || !Array.isArray(metaNames)) {
    reasons.push(`batch ${batchId}: repository files or SequelizeMeta state unavailable`)
    return { ok: false, reasons, batch }
  }
  const fileSet = new Set(files)
  const recorded = new Set(metaNames)
  const missing = batch.migrations.filter((m) => !fileSet.has(m))
  if (missing.length) reasons.push(`batch ${batchId}: missing migration file(s): ${missing.join(', ')}`)
  const already = batch.migrations.filter((m) => recorded.has(m))
  if (already.length) {
    reasons.push(`batch ${batchId}: already recorded in SequelizeMeta (unexpected ledger state): ${already.join(', ')}`)
  }
  if (reasons.length === 0) {
    const pending = [...files].sort().filter((f) => !recorded.has(f))
    const members = new Set(batch.migrations)
    const to = batch.migrations[batch.migrations.length - 1]
    const window = pending.slice(0, pending.indexOf(to) + 1)
    const outside = window.filter((f) => !members.has(f))
    if (outside.length) {
      reasons.push(`batch ${batchId}: pending migration(s) outside batch ${batchId} would run first: ${outside.join(', ')}`)
    } else if (window.length !== batch.expectedCount) {
      reasons.push(`batch ${batchId}: would execute ${window.length} migrations, expected ${batch.expectedCount}`)
    }
  }
  for (const gate of batch.openGates) reasons.push(`batch ${batchId}: open governance gate ${gate.id} — ${gate.reason}`)
  if (reasons.length) return { ok: false, reasons, batch }
  return { ok: true, reasons: [], batch, migrations: [...batch.migrations], to: batch.migrations[batch.migrations.length - 1] }
}

function pendingBatchMembers({ files, metaNames, batches = E2_BATCHES }) {
  const recorded = new Set(metaNames)
  const fileSet = new Set(files)
  const out = []
  for (const id of Object.keys(batches)) {
    for (const migration of batches[id].migrations) {
      if (fileSet.has(migration) && !recorded.has(migration)) out.push({ batch: id, migration })
    }
  }
  return out.sort((a, b) => (a.migration < b.migration ? -1 : 1))
}

// Post-run check: the runner must have recorded exactly the batch.
function verifyBatchRecorded({ migrations, before, after }) {
  const was = new Set(before)
  const added = after.filter((n) => !was.has(n))
  const now = new Set(after)
  const unexpected = added.filter((n) => !migrations.includes(n))
  const missing = migrations.filter((m) => !now.has(m))
  return { ok: unexpected.length === 0 && missing.length === 0, added, unexpected, missing }
}

module.exports = { E2_BATCHES, BATCH_ORDER, validateBatchDefinition, evaluateBatch, pendingBatchMembers, verifyBatchRecorded }
