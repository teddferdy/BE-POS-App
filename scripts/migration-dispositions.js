'use strict'

/**
 * W-01.1 / W-02R.4 — migration disposition contract (shared rules).
 *
 * D-02 (Model D): SequelizeMeta is the migration runner's DO-NOT-EXECUTE
 * ledger — a name recorded there must never be executed again by
 * sequelize-cli against that database. It does NOT assert historical
 * execution for rows recorded before W-01.1.
 *
 * A reviewed repository manifest (db/migration-dispositions/<env>.json)
 * records WHY a migration is recorded without being executed by the runner.
 * Migrations intended to run normally (E2) are deliberately absent from it.
 *
 * W-02R.4 adds a second, fully independent target: staging rehearsal uses
 * db/migration-dispositions/staging.json under the identical schema and
 * validation rules. Target -> manifest -> connection -> approval mappings
 * are disjoint by construction; a staging manifest can never authorize a
 * production action and vice versa (see the environment-mismatch refusal
 * in validateDispositionManifest plus per-target SHA and DB-identity
 * guards in the callers).
 *
 * This module is the single implementation of the manifest rules. The
 * verifier (check-production-schema.js), the stamper
 * (apply-migration-dispositions.js) and the runner preflight
 * (check-migration-preflight.js) all use it. It is pure: no database
 * access, no network, no writes.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..')
const DISPOSITIONS_DIR = path.join(ROOT, 'db', 'migration-dispositions')
const PRODUCTION_DISPOSITIONS_PATH = path.join(DISPOSITIONS_DIR, 'production.json')
const STAGING_DISPOSITIONS_PATH = path.join(DISPOSITIONS_DIR, 'staging.json')

const SCHEMA_VERSION = 1
// W-02R.4: staging is a second independent target. Every caller maps
// target -> manifest -> connection -> approval explicitly; no fallback.
const SUPPORTED_ENVIRONMENTS = Object.freeze(['production', 'staging'])

const DISPOSITIONS = Object.freeze({
  ATTESTED_PRESENT: 'ATTESTED_PRESENT',
  EXCLUDED_UNSAFE: 'EXCLUDED_UNSAFE',
  EXCLUDED_SUPERSEDED: 'EXCLUDED_SUPERSEDED',
  CONTROLLED_APPLY_PENDING: 'CONTROLLED_APPLY_PENDING',
  CONTROLLED_APPLIED: 'CONTROLLED_APPLIED',
  BLOCKED_DECISION: 'BLOCKED_DECISION',
  EXCLUDED_BY_DECISION: 'EXCLUDED_BY_DECISION'
})
const DISPOSITION_VALUES = Object.freeze(Object.values(DISPOSITIONS))

// Field rules per disposition: required / allowed conditional fields.
// evidenceRef is required on every row (every disposition is evidence-bearing).
const CONDITIONAL_FIELDS = Object.freeze({
  ATTESTED_PRESENT: { required: [], allowed: [] },
  EXCLUDED_UNSAFE: { required: [], allowed: [] },
  EXCLUDED_SUPERSEDED: { required: ['supersededBy'], allowed: ['supersededBy'] },
  // decisionRef only where the controlled apply is decision-dependent.
  CONTROLLED_APPLY_PENDING: { required: [], allowed: ['decisionRef'] },
  CONTROLLED_APPLIED: { required: ['applyRef'], allowed: ['applyRef', 'decisionRef'] },
  BLOCKED_DECISION: { required: ['decisionRef'], allowed: ['decisionRef'] },
  EXCLUDED_BY_DECISION: { required: ['decisionRef'], allowed: ['decisionRef'] }
})

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'environment',
  'evidenceCapturedAt',
  'approvedBy',
  'approvedAt',
  'migrations'
])
const ROW_KEYS = Object.freeze(['migration', 'disposition', 'evidenceRef', 'supersededBy', 'decisionRef', 'applyRef'])

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/
const DECISION_REF = /^(D|DR)-\d{2}\b/
const MIGRATION_NAME = /^\d{14}-[A-Za-z0-9._-]+\.js$/

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0
const isIsoUtc = (v) => typeof v === 'string' && ISO_UTC.test(v) && !Number.isNaN(Date.parse(v))

// Raw file bytes → sha256 hex. Binds stamping authorization to the exact
// reviewed manifest content.
function sha256OfFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

// Reads and parses a manifest file. Never throws for content problems:
// malformed JSON is reported as a validation error so callers fail closed.
function readDispositionManifest(filePath = PRODUCTION_DISPOSITIONS_PATH) {
  let text
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    return { manifest: null, errors: [`disposition manifest unreadable: ${filePath} (${err.code || err.message})`] }
  }
  try {
    return { manifest: JSON.parse(text), errors: [] }
  } catch (err) {
    return { manifest: null, errors: [`disposition manifest is malformed JSON: ${err.message}`] }
  }
}

/**
 * Validates a parsed manifest against the repository migration set.
 * Returns { ok, errors, approved, rows, names, byDisposition }.
 */
function validateDispositionManifest(manifest, { files, environment } = {}) {
  const errors = []
  const result = { ok: false, errors, approved: false, rows: [], names: [], byDisposition: {} }
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('validateDispositionManifest requires the repository migration file list')
  }
  const fileSet = new Set(files)

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('disposition manifest must be a JSON object')
    return result
  }
  for (const key of Object.keys(manifest)) {
    if (!TOP_LEVEL_KEYS.includes(key)) errors.push(`unknown top-level field "${key}"`)
  }
  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in manifest)) errors.push(`missing top-level field "${key}"`)
  }
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}`)
  }
  if (!SUPPORTED_ENVIRONMENTS.includes(manifest.environment)) {
    errors.push(`environment must be one of: ${SUPPORTED_ENVIRONMENTS.join(', ')}`)
  } else if (environment && manifest.environment !== environment) {
    errors.push(`manifest environment "${manifest.environment}" does not match target "${environment}"`)
  }
  if (!isIsoUtc(manifest.evidenceCapturedAt)) {
    errors.push('evidenceCapturedAt must be an ISO-8601 UTC timestamp')
  }

  // Approval is a whole-manifest act: both fields set, or both null (pending).
  const { approvedBy, approvedAt } = manifest
  if (approvedBy === null && approvedAt === null) {
    result.approved = false
  } else if (isNonEmptyString(approvedBy) && isIsoUtc(approvedAt)) {
    result.approved = true
    if (isIsoUtc(manifest.evidenceCapturedAt) && Date.parse(approvedAt) < Date.parse(manifest.evidenceCapturedAt)) {
      errors.push('approvedAt must not precede evidenceCapturedAt')
    }
  } else {
    errors.push('approvedBy and approvedAt must both be null (pending) or both set (non-empty approver, ISO-8601 UTC time)')
  }

  if (!Array.isArray(manifest.migrations) || manifest.migrations.length === 0) {
    errors.push('migrations must be a non-empty array')
    return result
  }

  const seen = new Set()
  const names = []
  manifest.migrations.forEach((row, i) => {
    const at = `migrations[${i}]`
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`${at} must be an object`)
      return
    }
    for (const key of Object.keys(row)) {
      if (!ROW_KEYS.includes(key)) errors.push(`${at}: unknown field "${key}"`)
    }
    const name = row.migration
    const label = isNonEmptyString(name) ? name : at
    if (!isNonEmptyString(name) || !MIGRATION_NAME.test(name)) {
      errors.push(`${at}: migration must be an exact migration filename`)
    } else {
      if (seen.has(name)) errors.push(`${label}: duplicate manifest entry`)
      seen.add(name)
      names.push(name)
      if (!fileSet.has(name)) errors.push(`${label}: unknown migration (no such file in db/migrations)`)
    }
    if (!DISPOSITION_VALUES.includes(row.disposition)) {
      errors.push(`${label}: invalid disposition "${row.disposition}"`)
      return
    }
    if (!isNonEmptyString(row.evidenceRef)) errors.push(`${label}: evidenceRef is required`)

    const rule = CONDITIONAL_FIELDS[row.disposition]
    for (const field of ['supersededBy', 'decisionRef', 'applyRef']) {
      const present = row[field] !== undefined
      if (rule.required.includes(field) && !isNonEmptyString(row[field])) {
        errors.push(`${label}: ${row.disposition} requires ${field}`)
      } else if (present && !rule.allowed.includes(field)) {
        errors.push(`${label}: ${field} is not allowed for ${row.disposition}`)
      } else if (present && !isNonEmptyString(row[field])) {
        errors.push(`${label}: ${field} must be a non-empty string`)
      }
    }
    if (isNonEmptyString(row.decisionRef) && !DECISION_REF.test(row.decisionRef)) {
      errors.push(`${label}: decisionRef must start with a decision id (D-nn or DR-nn)`)
    }
    if (row.disposition === DISPOSITIONS.EXCLUDED_SUPERSEDED && isNonEmptyString(row.supersededBy)) {
      const by = row.supersededBy
      if (!fileSet.has(by)) {
        errors.push(`${label}: supersededBy "${by}" is not a repository migration`)
      } else if (!(by > name)) {
        errors.push(`${label}: supersededBy "${by}" must be a later migration`)
      }
    }
    result.byDisposition[row.disposition] = (result.byDisposition[row.disposition] || 0) + 1
  })

  const sorted = [...names].sort()
  if (JSON.stringify(sorted) !== JSON.stringify(names)) {
    errors.push('migrations must be sorted by migration filename')
  }

  result.rows = manifest.migrations
  result.names = names
  result.ok = errors.length === 0
  return result
}

/**
 * Relates a VALID manifest to the recorded SequelizeMeta names.
 * Returns the disposition-level findings used by verifier and preflight.
 */
function evaluateDispositions({ validation, files, metaNames }) {
  if (!validation || !validation.ok) {
    throw new Error('evaluateDispositions requires a valid manifest validation result')
  }
  const metaSet = new Set(metaNames)
  const manifestSet = new Set(validation.names)
  const rows = validation.rows
  const of = (state) => rows.filter((r) => r.disposition === state)

  return {
    notRecorded: rows.filter((r) => !metaSet.has(r.migration)).map((r) => r.migration),
    controlledPending: of(DISPOSITIONS.CONTROLLED_APPLY_PENDING).map((r) => ({
      migration: r.migration,
      decisionRef: r.decisionRef || null
    })),
    blocked: of(DISPOSITIONS.BLOCKED_DECISION).map((r) => ({ migration: r.migration, decisionRef: r.decisionRef })),
    counts: {
      files: files.length,
      recorded: files.filter((f) => metaSet.has(f)).length,
      runnerRecorded: files.filter((f) => metaSet.has(f) && !manifestSet.has(f)).length,
      attested: of(DISPOSITIONS.ATTESTED_PRESENT).length,
      excluded:
        of(DISPOSITIONS.EXCLUDED_UNSAFE).length +
        of(DISPOSITIONS.EXCLUDED_SUPERSEDED).length +
        of(DISPOSITIONS.EXCLUDED_BY_DECISION).length,
      controlledApplied: of(DISPOSITIONS.CONTROLLED_APPLIED).length,
      controlledPending: of(DISPOSITIONS.CONTROLLED_APPLY_PENDING).length,
      blocked: of(DISPOSITIONS.BLOCKED_DECISION).length
    }
  }
}

// Mandatory wording: reports RECORDED state only. Never asserts that the
// population was executed or applied.
function describeRecordedState(counts) {
  return (
    `${counts.recorded}/${counts.files} recorded in SequelizeMeta: ` +
    `runner-recorded ${counts.runnerRecorded} (execution provenance not asserted for pre-W-01.1 rows), ` +
    `attested ${counts.attested}, excluded ${counts.excluded}, ` +
    `controlled-applied ${counts.controlledApplied}, controlled-pending ${counts.controlledPending}, ` +
    `blocked ${counts.blocked}`
  )
}

module.exports = {
  DISPOSITIONS_DIR,
  PRODUCTION_DISPOSITIONS_PATH,
  STAGING_DISPOSITIONS_PATH,
  SCHEMA_VERSION,
  SUPPORTED_ENVIRONMENTS,
  DISPOSITIONS,
  DISPOSITION_VALUES,
  CONDITIONAL_FIELDS,
  sha256OfFile,
  readDispositionManifest,
  validateDispositionManifest,
  evaluateDispositions,
  describeRecordedState
}
