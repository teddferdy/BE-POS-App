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
    // P1-CANONICAL-WRITES-VERIFIED: RESOLVED 2026-10-08 by formal gate
    // review (docs/superpowers/evidence/d08-b3-gate-review-record.md:
    // P1 canonical build f80ef8e live in production; CASH order #26 /
    // E_WALLET order #27 persisted canonically with reconciled side
    // effects; 154 green automated tests). Gate clearance makes B3
    // governance-eligible only: execution still needs its own explicit
    // authorization plus, per the D-08 record and RELEASING.md, an
    // execution-time restore point and fresh read-only preconditions.
    openGates: []
  })
})

const BATCH_ORDER = Object.freeze(['B1', 'B2', 'B3'])

// D-08 B1 resume contracts. A resume finishes a batch whose earlier members
// were recorded by an interrupted run; it never redefines the batch (the
// frozen B1 list above is the single source of membership). Each resume pins
// the exact incident ledger it may continue from and the ledger it must leave.
//
// B1-D05: on 2026-10-08 the production B1 run recorded B1 #1–#12 normally and
// D-05 aborted in its own preflight P1 (`unparseable active phone values
// (count=4)`, fail closed: no DDL, no rewrite). SequelizeMeta = 223 + 12 = 235.
// Record: docs/superpowers/evidence/d08-b1-d05-resume-record.md.
const deepFreezeResume = (resume) =>
  Object.freeze({
    ...resume,
    migrations: Object.freeze([...resume.migrations]),
    openGates: Object.freeze(resume.openGates.map((g) => Object.freeze({ ...g })))
  })

const BATCH_RESUMES = Object.freeze({
  'B1-D05': deepFreezeResume({
    id: 'B1-D05',
    batch: 'B1',
    title: 'B1 resume: D-05 only, after the 2026-10-08 D-05 preflight abort',
    recordedCount: 12,
    migrations: ['20261012000001-d05-member-identity-uniqueness.js'],
    ledgerBefore: 235,
    ledgerAfter: 236,
    postconditions: 'D05_MEMBER_IDENTITY',
    // D05-AFFECTED-ROWS-DISPOSITIONED: RESOLVED 2026-10-08 by formal gate
    // review (docs/superpowers/evidence/d08-b1-d05-gate-review-record.md:
    // owner TEST dispositions for all four affected rows, authorized full
    // reset superseding per-row verification, 9+9 live fixture lifecycle,
    // clean M08 recapture, 184 green automated tests). Gate clearance makes
    // B1-D05 governance-eligible only: execution still needs its own explicit
    // authorization plus, per the D-08 record and RELEASING.md, an
    // execution-time restore point and fresh read-only preconditions.
    openGates: []
  })
})

// D-05 postconditions, as PostgreSQL renders them in pg_indexes.indexdef
// (contract record d05-member-identity-contract.md §3.2): the four partial
// unique indexes exist on public.member with their expressions and
// predicates, no superseded historical member uniqueness object survives,
// and the backfill left no active non-guest phone outside E.164 form.
// Fragments (not whole strings) are matched, as in the D-05 migration test,
// so the check does not depend on the server's exact deparse formatting;
// the runner records the observed definitions verbatim as evidence.
const D05_TARGET_INDEXES = Object.freeze({
  uq_member_store_name_ci: Object.freeze(['(store, lower(TRIM(BOTH FROM name)))', '(store IS NOT NULL)', '("deletedAt" IS NULL)']),
  uq_member_global_name_ci: Object.freeze(['(lower(TRIM(BOTH FROM name)))', '(store IS NULL)', '("deletedAt" IS NULL)']),
  uq_member_phone_e164: Object.freeze(['("phoneNumber")', '("deletedAt" IS NULL)', "((\"phoneNumber\")::text !~~ 'GUEST-%'::text)"]),
  uq_member_email_ci: Object.freeze(['(lower(TRIM(BOTH FROM email)))', '("deletedAt" IS NULL)', '(email IS NOT NULL)'])
})
const D05_HISTORICAL_OBJECTS = Object.freeze([
  'uq_member_name',
  'uq_member_phoneNumber',
  'uq_member_email',
  'uq_member_store_name',
  'uq_member_global_name'
])

function verifyD05MemberIdentity(state) {
  const indexDefs = state && state.indexDefs
  const constraintNames = state && state.constraintNames
  const nonCanonical = state && state.nonCanonicalActivePhones
  if (!indexDefs || typeof indexDefs !== 'object' || !Array.isArray(constraintNames) || !Number.isInteger(nonCanonical)) {
    return { ok: false, failures: ['member index/constraint/phone state unavailable'] }
  }
  const failures = []
  for (const [name, fragments] of Object.entries(D05_TARGET_INDEXES)) {
    const def = indexDefs[name]
    if (typeof def !== 'string') {
      failures.push(`index ${name} missing`)
      continue
    }
    if (!def.startsWith('CREATE UNIQUE INDEX ')) failures.push(`index ${name} is not UNIQUE`)
    for (const f of ['ON public.member USING btree ', ...fragments]) {
      if (!def.includes(f)) failures.push(`index ${name} definition lacks "${f}"`)
    }
  }
  for (const name of D05_HISTORICAL_OBJECTS) {
    if (Object.prototype.hasOwnProperty.call(indexDefs, name) || constraintNames.includes(name)) {
      failures.push(`historical ${name} still present`)
    }
  }
  if (nonCanonical !== 0) failures.push(`${nonCanonical} active non-guest phone(s) not in E.164 form`)
  return { ok: failures.length === 0, failures }
}

const POSTCONDITIONS = Object.freeze({ D05_MEMBER_IDENTITY: verifyD05MemberIdentity })
const D05_TARGET_INDEX_NAMES = Object.freeze(Object.keys(D05_TARGET_INDEXES))

function validateResumeDefinition(resume, batches = E2_BATCHES) {
  const errors = []
  const batch = resume && Object.prototype.hasOwnProperty.call(batches, resume.batch) ? batches[resume.batch] : null
  if (!batch) return [`unknown base batch "${resume && resume.batch}"`]
  for (const e of validateBatchDefinition(batch)) errors.push(`base batch ${batch.id}: ${e}`)
  const list = Array.isArray(resume.migrations) ? resume.migrations : []
  if (list.length === 0) errors.push('resume lists no migrations')
  if (!Number.isInteger(resume.recordedCount) || resume.recordedCount + list.length !== batch.migrations.length) {
    errors.push(`recordedCount ${resume.recordedCount} + ${list.length} resume member(s) must equal the ${batch.migrations.length} members of ${batch.id}`)
  }
  const suffix = batch.migrations.slice(batch.migrations.length - list.length)
  if (list.length === 0 || list.some((m, i) => m !== suffix[i])) {
    errors.push(`resume members must be exactly the last ${list.length} member(s) of ${batch.id} (suffix), in order`)
  }
  if (!Number.isInteger(resume.ledgerBefore) || resume.ledgerAfter !== resume.ledgerBefore + list.length) {
    errors.push(`ledgerAfter ${resume.ledgerAfter} must equal ledgerBefore ${resume.ledgerBefore} + ${list.length}`)
  }
  if (!Object.prototype.hasOwnProperty.call(POSTCONDITIONS, resume.postconditions)) {
    errors.push(`unknown postcondition check "${resume.postconditions}"`)
  }
  return errors
}

// Decides whether `sequelize-cli db:migrate --to <to>` would execute exactly
// the resume members from exactly the pinned incident ledger: the batch
// prefix is fully recorded, no resume member is recorded, the ledger has the
// pinned row count with no duplicates, the pending list starts with exactly
// the resume members, and no governance gate is open.
function evaluateResume({ resumeId, files, metaNames, batches = E2_BATCHES, resumes = BATCH_RESUMES }) {
  const resume = Object.prototype.hasOwnProperty.call(resumes, resumeId) ? resumes[resumeId] : null
  if (!resume) return { ok: false, reasons: [`unknown resume "${resumeId}" (known: ${Object.keys(resumes).join(', ')})`] }
  const reasons = validateResumeDefinition(resume, batches).map((e) => `resume ${resumeId}: ${e}`)
  if (!Array.isArray(files) || !Array.isArray(metaNames)) {
    reasons.push(`resume ${resumeId}: repository files or SequelizeMeta state unavailable`)
    return { ok: false, reasons, resume }
  }
  if (reasons.length === 0) {
    const batch = batches[resume.batch]
    const prefix = batch.migrations.slice(0, resume.recordedCount)
    const fileSet = new Set(files)
    const recorded = new Set(metaNames)
    if (recorded.size !== metaNames.length) reasons.push(`resume ${resumeId}: SequelizeMeta contains duplicate names`)
    const missing = batch.migrations.filter((m) => !fileSet.has(m))
    if (missing.length) reasons.push(`resume ${resumeId}: missing migration file(s): ${missing.join(', ')}`)
    const notRecorded = prefix.filter((m) => !recorded.has(m))
    if (notRecorded.length) {
      reasons.push(`resume ${resumeId}: expected recorded ${batch.id} member(s) not recorded: ${notRecorded.join(', ')}`)
    }
    const already = resume.migrations.filter((m) => recorded.has(m))
    if (already.length) reasons.push(`resume ${resumeId}: already recorded in SequelizeMeta: ${already.join(', ')}`)
    if (metaNames.length !== resume.ledgerBefore) {
      reasons.push(`resume ${resumeId}: SequelizeMeta has ${metaNames.length} row(s); the ${resumeId} resume requires exactly ${resume.ledgerBefore} (verified incident state)`)
    }
    if (reasons.length === 0) {
      const pending = [...files].sort().filter((f) => !recorded.has(f))
      const to = resume.migrations[resume.migrations.length - 1]
      const window = pending.slice(0, pending.indexOf(to) + 1)
      const outside = window.filter((f) => !resume.migrations.includes(f))
      if (outside.length) {
        reasons.push(`resume ${resumeId}: pending migration(s) outside ${resumeId} would run first: ${outside.join(', ')}`)
      } else if (window.length !== resume.migrations.length) {
        reasons.push(`resume ${resumeId}: would execute ${window.length} migrations, expected ${resume.migrations.length}`)
      }
    }
  }
  for (const gate of resume.openGates) reasons.push(`resume ${resumeId}: open governance gate ${gate.id} — ${gate.reason}`)
  if (reasons.length) return { ok: false, reasons, resume }
  return {
    ok: true,
    reasons: [],
    resume,
    migrations: [...resume.migrations],
    to: resume.migrations[resume.migrations.length - 1],
    ledgerAfter: resume.ledgerAfter
  }
}

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
function evaluateBatch({ batchId, files, metaNames, batches = E2_BATCHES, resumes = BATCH_RESUMES }) {
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
    const resumeIds = Object.keys(resumes).filter((id) => resumes[id].batch === batchId)
    const hint = resumeIds.length
      ? `; a partially recorded batch continues only through its reviewed resume contract (--resume ${resumeIds.join(' | ')})`
      : ''
    reasons.push(`batch ${batchId}: already recorded in SequelizeMeta (unexpected ledger state): ${already.join(', ')}${hint}`)
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

module.exports = {
  E2_BATCHES,
  BATCH_ORDER,
  BATCH_RESUMES,
  POSTCONDITIONS,
  D05_TARGET_INDEX_NAMES,
  validateBatchDefinition,
  validateResumeDefinition,
  evaluateBatch,
  evaluateResume,
  pendingBatchMembers,
  verifyBatchRecorded
}
