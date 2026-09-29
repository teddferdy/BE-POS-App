'use strict'

// T-02 — approved mapping-artifact validation boundary.
//
// Two explicit input boundaries exist and must not be confused:
//
// LEGACY PRE-FLIGHT INPUT (unchanged, scripts/tenant-backfill-preflight.js):
//   - bare row array, or { rows: [...] }
//   - unknown row fields are silently dropped by normalizeRow
//   - no ownership metadata beyond source/reviewer/approval/effectiveAt
//   - consumed by existing tooling, fixtures, and the test-only apply harness
//
// APPROVED ARTIFACT (this module):
//   - strict { rows, meta } contract per tenant-mapping-artifact.schema.json
//   - unknown artifact/row/meta fields are REJECTED, never dropped
//   - artifact-level ownership metadata (preparer, reviewer-as-approver,
//     preparedAt/reviewedAt, evidenceRef) is REQUIRED
//   - row validation is delegated to the frozen legacy validateStoreMapping,
//     so T-01 D7 enforcement, error vocabulary, duplicate handling, sorting,
//     and summary semantics are inherited unchanged
//
// Ownership model (approved decisions):
//   - reviewer IS the approver; there is no separate approver field, and an
//     `approver` key anywhere in the artifact is rejected as unknown
//   - preparer is required and is never inferred from source
//   - preparer and reviewer are independent identities: the contract allows
//     preparer != reviewer and does not force them apart (no existing
//     repository contract requires distinctness; D7 constrains only
//     source vs reviewer)
//   - meta.reviewer binds the artifact: it must equal every row reviewer
//     (single-approver artifact); mismatch is META_REVIEWER_MISMATCH
//
// This module performs no writes, opens no database connections, uses no JWT
// claims, and provides no production execution path. File ingestion
// (readMappingArtifactFile) only reads and parses a JSON file for
// programmatic/test use.

const fs = require('fs')
const { validateStoreMapping } = require('./tenant-backfill-preflight')

const ROW_FIELDS = Object.freeze([
  'storeId',
  'disposition',
  'tenantId',
  'source',
  'reviewer',
  'approval',
  'effectiveAt'
])
const META_FIELDS = Object.freeze([
  'preparer',
  'reviewer',
  'approval',
  'preparedAt',
  'reviewedAt',
  'evidenceRef'
])

const artifactError = (code, field, message) => ({ code, field, message })

// Mirrors the deterministic ordering of the legacy preflight comparator
// (code, then field, then message). Kept local so the frozen preflight
// module is not modified; Array.prototype.sort is stable, so insertion
// order (strict errors in check order, then legacy summary errors) breaks
// any residual ties deterministically.
const compareArtifactErrors = (left, right) => {
  if (left.code !== right.code) return left.code < right.code ? -1 : 1
  if (left.field !== right.field) return left.field < right.field ? -1 : 1
  if (left.message !== right.message) return left.message < right.message ? -1 : 1
  return 0
}

const trimText = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

// Strict ISO-8601 UTC instant: full calendar validity is enforced, so
// values such as month 13 or February 30 are rejected rather than rolled
// over by the Date parser.
const ISO_UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/

const parseIsoUtc = (value) => {
  if (typeof value !== 'string') return null
  const match = ISO_UTC_PATTERN.exec(value)
  if (!match) return null
  const millis = Date.parse(value)
  if (!Number.isFinite(millis)) return null
  const date = new Date(millis)
  const fractionMillis = match[7] ? Number(`${match[7]}000`.slice(0, 3)) : 0
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getUTCHours() !== Number(match[4]) ||
    date.getUTCMinutes() !== Number(match[5]) ||
    date.getUTCSeconds() !== Number(match[6]) ||
    date.getUTCMilliseconds() !== fractionMillis
  ) {
    return null
  }
  return millis
}

const normalizeMeta = (meta) => ({
  preparer: trimText(meta.preparer),
  reviewer: trimText(meta.reviewer),
  approval:
    typeof meta.approval === 'string' ? trimText(meta.approval)?.toLowerCase() || null : null,
  preparedAt: trimText(meta.preparedAt),
  reviewedAt: trimText(meta.reviewedAt),
  evidenceRef: trimText(meta.evidenceRef)
})

const validateMetaShape = (meta, errors) => {
  for (const key of Object.keys(meta)) {
    if (!META_FIELDS.includes(key)) {
      errors.push(artifactError('UNKNOWN_META_FIELD', `meta.${key}`, `unknown artifact metadata field ${key}`))
    }
  }
  const normalized = normalizeMeta(meta)
  if (normalized.preparer === null) {
    errors.push(artifactError('MISSING_PREPARER', 'meta.preparer', 'meta.preparer is required'))
  }
  if (normalized.reviewer === null) {
    errors.push(artifactError('MISSING_REVIEWER', 'meta.reviewer', 'meta.reviewer is required'))
  }
  if (normalized.approval === null) {
    errors.push(artifactError('MISSING_APPROVAL', 'meta.approval', 'meta.approval is required'))
  } else if (normalized.approval !== 'approved') {
    errors.push(artifactError('UNAPPROVED', 'meta.approval', 'approval must be approved'))
  }
  if (normalized.preparedAt === null) {
    errors.push(artifactError('MISSING_PREPARED_AT', 'meta.preparedAt', 'meta.preparedAt is required'))
  } else if (parseIsoUtc(normalized.preparedAt) === null) {
    errors.push(
      artifactError('INVALID_PREPARED_AT', 'meta.preparedAt', 'meta.preparedAt must be a valid ISO-8601 UTC timestamp')
    )
  }
  if (normalized.reviewedAt === null) {
    errors.push(artifactError('MISSING_REVIEWED_AT', 'meta.reviewedAt', 'meta.reviewedAt is required'))
  } else if (parseIsoUtc(normalized.reviewedAt) === null) {
    errors.push(
      artifactError('INVALID_REVIEWED_AT', 'meta.reviewedAt', 'meta.reviewedAt must be a valid ISO-8601 UTC timestamp')
    )
  }
  if (normalized.evidenceRef === null) {
    errors.push(artifactError('MISSING_EVIDENCE_REF', 'meta.evidenceRef', 'meta.evidenceRef is required'))
  }
  return normalized
}

const validateRowKeys = (rows, errors) => {
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(artifactError('INVALID_ROW_SHAPE', `rows[${index}]`, `row ${index} must be an object`))
      return
    }
    for (const key of Object.keys(row)) {
      if (!ROW_FIELDS.includes(key)) {
        errors.push(artifactError('UNKNOWN_ROW_FIELD', `rows[${index}].${key}`, `unknown row field ${key}`))
      }
    }
  })
}

// Single-approver artifact binding: every row reviewer must equal the
// artifact reviewer (case-insensitive on trimmed values, mirroring D7
// comparison semantics). Rows without a reviewer are left to the legacy
// MISSING_REVIEWER check; the binding only applies where both sides exist.
const validateReviewerBinding = (rows, metaReviewer, errors) => {
  if (metaReviewer === null) return
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return
    const rowReviewer = trimText(row.reviewer)
    if (rowReviewer === null) return
    if (rowReviewer.toLowerCase() !== metaReviewer.toLowerCase()) {
      errors.push({
        ...artifactError(
          'META_REVIEWER_MISMATCH',
          'meta.reviewer',
          `meta.reviewer must equal the reviewer of every row (row ${index} differs)`
        ),
        rowIndex: index
      })
    }
  })
}

// Validates a strict approved artifact: { rows, meta } plus persisted store
// snapshots (plain objects, same shape the legacy preflight accepts).
// Performs no writes and requires no database handle.
//
// Returns { valid, meta, summary, errors } where meta is the normalized
// artifact metadata (null when meta is absent or invalid), summary is the
// legacy validateStoreMapping result (null when rows is not an array), and
// errors merges strict artifact errors with legacy summary errors in
// deterministic order. Bare arrays and { rows } without meta are rejected
// here: they belong to the legacy pre-flight boundary, whose behavior is
// preserved untouched in tenant-backfill-preflight.js.
const validateMappingArtifact = (artifact, stores) => {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return {
      valid: false,
      meta: null,
      summary: null,
      errors: [
        artifactError(
          'INVALID_ARTIFACT_SHAPE',
          'artifact',
          'approved artifact must be an object with rows and meta'
        )
      ]
    }
  }

  const strictErrors = []
  for (const key of Object.keys(artifact)) {
    if (key !== 'rows' && key !== 'meta') {
      strictErrors.push(artifactError('UNKNOWN_ARTIFACT_FIELD', `artifact.${key}`, `unknown artifact field ${key}`))
    }
  }
  if (!Array.isArray(artifact.rows)) {
    strictErrors.push(artifactError('INVALID_ARTIFACT_SHAPE', 'rows', 'artifact.rows must be a non-empty array'))
  }
  let normalizedMeta = null
  if (artifact.meta == null) {
    strictErrors.push(artifactError('MISSING_META', 'meta', 'artifact.meta is required'))
  } else if (typeof artifact.meta !== 'object' || Array.isArray(artifact.meta)) {
    strictErrors.push(artifactError('INVALID_ARTIFACT_SHAPE', 'meta', 'artifact.meta must be an object'))
  } else {
    normalizedMeta = validateMetaShape(artifact.meta, strictErrors)
  }

  let summary = null
  if (Array.isArray(artifact.rows)) {
    validateRowKeys(artifact.rows, strictErrors)
    validateReviewerBinding(artifact.rows, normalizedMeta?.reviewer ?? null, strictErrors)
    summary = validateStoreMapping(artifact.rows, stores)
  }

  const errors = [...strictErrors, ...(summary ? summary.errors : [])].sort(compareArtifactErrors)
  const metaValid = normalizedMeta !== null && strictErrors.length === 0
  return {
    valid: errors.length === 0,
    meta: metaValid ? normalizedMeta : null,
    summary,
    errors
  }
}

// Reads a file-based JSON mapping artifact for programmatic/test use.
// Reads and parses only; no validation side effects, no writes, no
// production execution path. Throws a descriptive Error when the file
// cannot be read or is not valid JSON.
const readMappingArtifactFile = (filePath) => {
  let raw
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    throw new Error(`[mapping-artifact] cannot read artifact file: ${err.message}`)
  }
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`[mapping-artifact] artifact file is not valid JSON: ${err.message}`)
  }
}

module.exports = {
  ROW_FIELDS,
  META_FIELDS,
  validateMappingArtifact,
  readMappingArtifactFile
}
