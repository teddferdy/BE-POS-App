'use strict'

/**
 * D-08 — production controlled-apply tool (missing-effects-only).
 *
 * Applies EXACTLY the three CONTROLLED_APPLY_PENDING missing effects to the
 * production database. This is NOT a generic migration runner and NOT an
 * arbitrary-SQL runner: the allowlist is hard-coded below, every other
 * migration filename is refused, and each allowlisted entry executes only its
 * reviewed missing-effects operation (never a blind whole-file replay).
 *
 * Safety contract — 12 gates (all fail closed):
 *   Gate 1  Environment: --target must be exactly "production". Anything else
 *           (local, development, staging, rehearsal, unknown) is refused.
 *   Gate 2  Database identity: current_database() must equal the configured
 *           POSTGRES_DATABASE; the production host must not be local; the
 *           staging database name must not equal the production database name.
 *   Gate 3  Manifest SHA: --apply requires --authorize-manifest-sha256 to
 *           equal the sha256 of the manifest file bytes, and the manifest
 *           must be whole-file approved (approvedBy/approvedAt set).
 *   Gate 4  Ledger state: the selected migration row must currently be
 *           CONTROLLED_APPLY_PENDING. Every other disposition is refused.
 *   Gate 5  Allowlist: the migration must be one of the three hard-coded
 *           ALLOWLIST entries. Unknown filenames are refused even if the
 *           manifest row is pending.
 *   Gate 6  Preconditions: migration-specific read-only checks (uniqueness
 *           scans, NULL guards, FK orphan scans, schema assumptions) must
 *           pass before any mutation. Failures refuse without writing.
 *   Gate 7  Backup: --backup-evidence must point to a JSON document
 *           satisfying the BACKUP EVIDENCE CONTRACT below (identity, scope,
 *           freshness, completion, release binding).
 *   Gate 8  Authorization: --authorization-ref (a separately issued change /
 *           approval reference) is required. Manifest approval NEVER implies
 *           controlled-apply authorization.
 *   Gate 9  Operator confirmation: --apply additionally requires
 *           --confirm=<exact migration filename> plus --operator=<id>.
 *           No default yes, no bare --yes flag exists.
 *   Gate 10 Execution: only the missing-effects operation runs, inside one
 *           transaction with a statement timeout. Any statement failure rolls
 *           back everything; the disposition is never touched on failure.
 *   Gate 11 Postcondition: the intended schema effect is re-read from the
 *           catalogs inside the same transaction (index present WITH the
 *           expected definition, NOT NULL enforced). Mismatch rolls back.
 *   Gate 12 Ledger update: only after successful execution + postcondition,
 *           the manifest row flips PENDING -> CONTROLLED_APPLIED with an
 *           immutable applyRef, via compare-and-swap on freshly re-read file
 *           state (CAP-003: SHA must still equal the authorized SHA and the
 *           row must still be PENDING; otherwise refuse). The manifest file
 *           is re-validated after the edit; the edit is atomic (tmp + rename).
 *           NOTE: this changes the manifest SHA, so manifest re-approval is
 *           required afterwards (see RELEASING.md / D-08 roadmap).
 *           CAP-003 concurrency: the whole apply phase runs on one pinned
 *           PostgreSQL session holding a cross-process advisory lock
 *           ('controlled-apply-production/v1') from acquisition until the CAS
 *           completes, so concurrent applies serialize instead of racing.
 *
 * Modes:
 *   - Default is DRY-RUN: every gate except the mutation runs (including a
 *     live read-only precondition scan when a database is reachable), and
 *     nothing is written. Dry-run still requires the full authorization
 *     material so operators validate the whole chain before the real run.
 *   - --apply performs the mutation. Requires --confirm + --operator.
 *
 * BACKUP EVIDENCE CONTRACT (Gate 7). The JSON document must contain:
 *   databaseIdentity   current_database() the backup was taken from
 *   environment         must be "production"
 *   backupTimestamp     ISO-8601 UTC, not in the future, age <= 72h
 *   mechanism          non-empty (e.g. "pg_dump custom-format full-database")
 *   scope              non-empty (must state full-database coverage)
 *   completionStatus   must be "success"
 *   backupRef          non-empty identifier (db_backup row id + filename, or
 *                      provider snapshot id)
 *   retention          non-empty statement of where the artifact lives and
 *                      how long it is kept / accessible
 *   restoreCapability  non-empty statement of the restore mechanism; a
 *                      never-drilled restore MUST be declared as
 *                      "UNTESTED: <mechanism>, no restore drill performed".
 *                      An untested backup is never represented as tested.
 *   releaseManifestSha must equal the authorized manifest sha256 (binds the
 *                      backup to this release state)
 *   operator           non-empty (who took / verified the backup)
 *
 * Failure semantics: every refusal throws RefusedError (gate violation, exit
 * 1, nothing written); every execution failure throws ApplyError (exit 1,
 * transaction rolled back, disposition untouched). No automatic retry:
 * retry = re-invoke the full command (operations are idempotent).
 *
 * This script is NEVER run by CI and is never invoked by the migration
 * runner. Production controlled apply is a separately authorized
 * operational action.
 */

const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const rules = require('./migration-dispositions')
const { discoverMigrationFiles } = require('./apply-migration-dispositions')

const PRODUCTION_MANIFEST = rules.PRODUCTION_DISPOSITIONS_PATH

// Gate 5 — hard-coded allowlist. Keys are exact migration filenames, values
// bind each filename to its reviewed missing-effects operation. Frozen.
const ALLOWLIST = Object.freeze({
  '20260812010000-create-region-table.js': Object.freeze({
    kind: 'region-indexes',
    description: 'region missing-effect indexes only (table must already exist)'
  }),
  '20260829000001-create-product-review-table.js': Object.freeze({
    kind: 'product-review-indexes',
    description: 'product_review missing-effect lookup indexes only (non-unique)'
  }),
  '20260906000004-split-bill-hardening.js': Object.freeze({
    kind: 'split-bill-hardening',
    description: 'split_bill.status SET NOT NULL + idempotencyKey column/index only'
  })
})

const REGION_INDEXES = Object.freeze([
  Object.freeze({ name: 'region_code_unique', columns: ['code'], unique: true }),
  Object.freeze({ name: 'region_level_idx', columns: ['level'], unique: false }),
  Object.freeze({ name: 'region_parent_code_idx', columns: ['parentCode'], unique: false })
])
const PRODUCT_REVIEW_INDEXES = Object.freeze([
  Object.freeze({ name: 'product_review_product_store', columns: ['productId', 'store'], unique: false }),
  Object.freeze({ name: 'product_review_store', columns: ['store'], unique: false })
])
const SPLIT_BILL_INDEX = Object.freeze({ name: 'split_bill_order_idempotencykey', columns: ['order', 'idempotencyKey'], unique: false })

const BACKUP_MAX_AGE_MS = 72 * 60 * 60 * 1000
const STATEMENT_TIMEOUT_MS = 120000
// CAP-003: bounded wait for the cross-process advisory serialization lock.
// Contenders refuse (fail closed) instead of queueing indefinitely.
const ADVISORY_LOCK_TIMEOUT_MS = 10000
const ADVISORY_LOCK_POLL_MS = 50
// CAP-004 increment 1: versioned successful-evidence contract. Evidence
// records what was authorized (authorizedManifestSha) and what was actually
// produced (resultingManifestSha, measured from disk after CAS).
const EVIDENCE_SCHEMA_VERSION = 1
const EVIDENCE_HEX64 = /^[0-9a-f]{64}$/
const LOCAL_HOSTS = Object.freeze(['localhost', '127.0.0.1', '::1'])
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,120}$/
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

class RefusedError extends Error {
  constructor(message) {
    super(`[controlled-apply] REFUSED: ${message}`)
    this.name = 'RefusedError'
  }
}

class ApplyError extends Error {
  constructor(message) {
    super(`[controlled-apply] FAILED: ${message}`)
    this.name = 'ApplyError'
  }
}

// CLI parsing. Unknown flags are refused (fail closed).
function parseArgs(argv) {
  const opts = {
    target: null,
    migration: null,
    apply: false,
    authorizeSha256: null,
    authorizationRef: null,
    backupEvidence: null,
    confirm: null,
    operator: null,
    evidenceOut: null
  }
  for (const arg of argv) {
    if (arg === '--apply') opts.apply = true
    else if (arg.startsWith('--target=')) opts.target = arg.slice('--target='.length)
    else if (arg.startsWith('--migration=')) opts.migration = arg.slice('--migration='.length)
    else if (arg.startsWith('--authorize-manifest-sha256=')) opts.authorizeSha256 = arg.slice('--authorize-manifest-sha256='.length)
    else if (arg.startsWith('--authorization-ref=')) opts.authorizationRef = arg.slice('--authorization-ref='.length)
    else if (arg.startsWith('--backup-evidence=')) opts.backupEvidence = arg.slice('--backup-evidence='.length)
    else if (arg.startsWith('--confirm=')) opts.confirm = arg.slice('--confirm='.length)
    else if (arg.startsWith('--operator=')) opts.operator = arg.slice('--operator='.length)
    // CAP-001: no --manifest override. The production CLI is permanently
    // bound to the canonical production manifest (resolveProductionManifestPath).
    // Manifest-path injection exists ONLY below the CLI boundary, as an
    // explicit runControlledApply() parameter for unit tests.
    else if (arg.startsWith('--evidence-out=')) opts.evidenceOut = arg.slice('--evidence-out='.length)
    else throw new RefusedError(`unknown argument "${arg}"`)
  }
  // Gate 1 — exact production target, no default.
  if (!opts.target) throw new RefusedError('--target=<environment> is required (no default)')
  if (opts.target !== 'production') {
    throw new RefusedError(`target "${opts.target}" is not production; controlled apply refuses non-production targets`)
  }
  if (!opts.migration) throw new RefusedError('--migration=<exact filename> is required (no default)')
  // Gate 5 — allowlist membership is checked before any connection is opened.
  if (!Object.prototype.hasOwnProperty.call(ALLOWLIST, opts.migration)) {
    throw new RefusedError(`migration "${opts.migration}" is not on the controlled-apply allowlist (arbitrary migrations refused)`)
  }
  if (!opts.authorizationRef || !REF_PATTERN.test(opts.authorizationRef)) {
    throw new RefusedError('--authorization-ref=<change/approval reference> is required (manifest approval never implies apply authorization)')
  }
  if (!opts.operator || !REF_PATTERN.test(opts.operator)) {
    throw new RefusedError('--operator=<operator id> is required (auditable execution record)')
  }
  if (!opts.backupEvidence) throw new RefusedError('--backup-evidence=<path to Gate-7 JSON> is required')
  if (opts.apply) {
    if (!/^[0-9a-f]{64}$/.test(opts.authorizeSha256 || '')) {
      throw new RefusedError('--apply requires --authorize-manifest-sha256=<64-hex sha256 of the manifest file>')
    }
    // Gate 9 — explicit typed confirmation: the exact migration filename.
    if (opts.confirm !== opts.migration) {
      throw new RefusedError('--apply requires --confirm=<exact migration filename> (typed confirmation)')
    }
  } else if (opts.confirm) {
    throw new RefusedError('--confirm is only meaningful with --apply')
  }
  if (!opts.apply && opts.authorizeSha256 && !/^[0-9a-f]{64}$/.test(opts.authorizeSha256)) {
    throw new RefusedError('--authorize-manifest-sha256 must be a 64-hex sha256 when provided')
  }
  return opts
}

function sha256OfFile(filePath) {
  return rules.sha256OfFile(filePath)
}

// INV-004-01 — evidence destination isolation. Canonical-form comparison
// (never raw strings): resolves symlinks where the path exists and falls
// back to lexical resolution for not-yet-existing destinations, so exact,
// relative, ./ -prefixed, ../ -normalized, and symlink-equivalent paths to
// the manifest are all recognized.
function canonicalEvidenceForm(p) {
  try {
    return fs.realpathSync(p)
  } catch {
    try {
      return path.join(fs.realpathSync(path.dirname(p)), path.basename(p))
    } catch {
      return path.resolve(p)
    }
  }
}

function evidenceOutTargetsManifest({ manifestPath, evidenceOut }) {
  if (!evidenceOut) return false
  return canonicalEvidenceForm(evidenceOut) === canonicalEvidenceForm(manifestPath)
}

// INV-004-02 — pure, side-effect-free validator for successful (v1)
// evidence. Validates schemaVersion, required fields, SHA/timestamp
// formats, and outcome/status semantics. Deliberately does NOT require
// resultingManifestSha !== authorizedManifestSha: equality is a statement
// about state, not a validity signal.
function validateApplyEvidence(evidence) {
  const errors = []
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { ok: false, errors: ['evidence must be an object'] }
  }
  if (evidence.schemaVersion !== EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${EVIDENCE_SCHEMA_VERSION}`)
  }
  const isApplied = evidence.outcome === 'applied'
  if (!isApplied && evidence.outcome !== 'dry-run-ok') {
    errors.push('outcome must be one of: applied, dry-run-ok')
  }
  if (isApplied && evidence.mode !== 'apply') errors.push('applied evidence requires mode "apply"')
  if (!isApplied && evidence.mode !== 'dry-run') errors.push('dry-run evidence requires mode "dry-run"')
  if (evidence.status !== 'ok') errors.push('status must be "ok"')
  if (!EVIDENCE_HEX64.test(evidence.authorizedManifestSha || '')) {
    errors.push('authorizedManifestSha must be a 64-hex sha256')
  }
  if (isApplied) {
    if (!EVIDENCE_HEX64.test(evidence.resultingManifestSha || '')) {
      errors.push('applied evidence requires resultingManifestSha (64-hex sha256 of the post-CAS manifest)')
    }
  } else if (evidence.resultingManifestSha !== null && evidence.resultingManifestSha !== undefined) {
    errors.push('dry-run evidence must not carry a resultingManifestSha')
  }
  for (const field of ['migration', 'kind', 'environment', 'databaseIdentity', 'operator', 'authorizationRef', 'backupRef']) {
    if (typeof evidence[field] !== 'string' || evidence[field].trim().length === 0) {
      errors.push(`evidence missing or empty required field "${field}"`)
    }
  }
  for (const field of ['startedAt', 'endedAt']) {
    if (!ISO_UTC.test(evidence[field] || '') || Number.isNaN(Date.parse(evidence[field]))) {
      errors.push(`evidence field "${field}" must be an ISO-8601 UTC timestamp`)
    }
  }
  if (!Array.isArray(evidence.preconditions)) errors.push('preconditions must be an array')
  if (!Array.isArray(evidence.applied)) {
    errors.push('applied must be an array')
  } else if (isApplied && evidence.applied.length === 0) {
    errors.push('applied evidence requires a non-empty applied effect list')
  } else if (!isApplied && evidence.applied.length !== 0) {
    errors.push('dry-run evidence must have an empty applied effect list')
  }
  if (isApplied && evidence.postcondition !== 'verified-in-transaction') {
    errors.push('applied evidence requires postcondition "verified-in-transaction"')
  }
  if (!isApplied && evidence.postcondition !== 'not-executed-dry-run') {
    errors.push('dry-run evidence requires postcondition "not-executed-dry-run"')
  }
  if (evidence.dispositionBefore !== rules.DISPOSITIONS.CONTROLLED_APPLY_PENDING) {
    errors.push('dispositionBefore must be CONTROLLED_APPLY_PENDING')
  }
  const expectedAfter = isApplied
    ? rules.DISPOSITIONS.CONTROLLED_APPLIED
    : rules.DISPOSITIONS.CONTROLLED_APPLY_PENDING
  if (evidence.dispositionAfter !== expectedAfter) {
    errors.push(`dispositionAfter must be ${expectedAfter}`)
  }
  if (isApplied) {
    if (typeof evidence.applyRef !== 'string' || !evidence.applyRef.startsWith('controlled-apply/')) {
      errors.push('applied evidence requires an applyRef')
    }
  } else if (evidence.applyRef !== null && evidence.applyRef !== undefined) {
    errors.push('dry-run evidence must not carry an applyRef')
  }
  return { ok: errors.length === 0, errors }
}

// Evidence persistence validates first: malformed/fabricated evidence is
// never written. (Outcome separation for persistence failure itself is a
// later CAP-004 increment; a validation failure here throws loudly.)
function writeEvidenceOut(evidenceOut, evidence) {
  const validation = validateApplyEvidence(evidence)
  if (!validation.ok) {
    throw new ApplyError(`evidence failed contract validation — ${validation.errors.join('; ')} (nothing was persisted)`)
  }
  fs.writeFileSync(evidenceOut, `${JSON.stringify(evidence, null, 2)}\n`)
}

// CAP-001: canonical production manifest resolution. The production CLI path
// (main()) ALWAYS uses this — there is no flag, default, or override that
// can redirect production execution to another manifest file. Unit tests
// inject fixture manifests by calling runControlledApply() directly with an
// explicit manifestPath; that parameter never crosses the CLI boundary.
function resolveProductionManifestPath() {
  return PRODUCTION_MANIFEST
}

// Gate 3 (file half) + Gate 4. Validates the manifest and asserts the row is
// currently CONTROLLED_APPLY_PENDING. Runs before any connection is opened.
function verifyManifestRow({ manifest, manifestPath, files, environment, migration, authorizeSha256, apply }) {
  const validation = rules.validateDispositionManifest(manifest, { files, environment })
  if (!validation.ok) {
    throw new RefusedError(`manifest invalid — ${validation.errors.join('; ')}`)
  }
  if (apply) {
    const actual = sha256OfFile(manifestPath)
    if (actual !== authorizeSha256) {
      throw new RefusedError(`manifest sha256 ${actual} does not match the authorized sha256`)
    }
    if (!validation.approved) {
      throw new RefusedError('manifest is not approved (approvedBy/approvedAt pending); mutation refused')
    }
  }
  const row = manifest.migrations.find((r) => r.migration === migration)
  if (!row) throw new RefusedError(`migration "${migration}" has no manifest row`)
  if (row.disposition !== rules.DISPOSITIONS.CONTROLLED_APPLY_PENDING) {
    throw new RefusedError(`migration "${migration}" disposition is ${row.disposition}, not CONTROLLED_APPLY_PENDING`)
  }
  return { validation, row }
}

// Gate 7 — backup evidence contract. Pure: no database access.
function verifyBackupEvidence({ evidencePath, expectedDatabase, manifestSha, nowMs = Date.now() }) {
  let raw
  try {
    raw = fs.readFileSync(evidencePath, 'utf8')
  } catch {
    throw new RefusedError(`backup evidence unreadable at "${evidencePath}"`)
  }
  let doc
  try {
    doc = JSON.parse(raw)
  } catch {
    throw new RefusedError('backup evidence is not valid JSON')
  }
  const required = [
    'databaseIdentity', 'environment', 'backupTimestamp', 'mechanism',
    'scope', 'completionStatus', 'backupRef', 'retention',
    'restoreCapability', 'releaseManifestSha', 'operator'
  ]
  for (const field of required) {
    if (typeof doc[field] !== 'string' || doc[field].trim().length === 0) {
      throw new RefusedError(`backup evidence missing or empty required field "${field}"`)
    }
  }
  if (doc.environment !== 'production') {
    throw new RefusedError(`backup evidence environment is "${doc.environment}", not production`)
  }
  if (doc.databaseIdentity !== expectedDatabase) {
    throw new RefusedError(`backup evidence database "${doc.databaseIdentity}" does not match target database "${expectedDatabase}"`)
  }
  if (!ISO_UTC.test(doc.backupTimestamp) || Number.isNaN(Date.parse(doc.backupTimestamp))) {
    throw new RefusedError('backup evidence backupTimestamp must be ISO-8601 UTC (e.g. 2026-10-06T00:00:00Z)')
  }
  const ts = Date.parse(doc.backupTimestamp)
  if (ts > nowMs) throw new RefusedError('backup evidence backupTimestamp is in the future')
  if (nowMs - ts > BACKUP_MAX_AGE_MS) {
    throw new RefusedError('backup evidence is older than 72h; take a fresh pre-apply backup')
  }
  if (doc.completionStatus !== 'success') {
    throw new RefusedError(`backup completionStatus is "${doc.completionStatus}", not success`)
  }
  if (doc.releaseManifestSha !== manifestSha) {
    throw new RefusedError('backup evidence releaseManifestSha does not match the authorized manifest sha256 (backup is not bound to this release)')
  }
  return doc
}

function buildProductionSequelize() {
  require('dotenv').config({ path: `${process.cwd()}/.env.production` })
  const { Sequelize } = require('sequelize')
  const pg = require('pg')
  for (const v of ['POSTGRES_USER', 'POSTGRES_DATABASE', 'POSTGRES_HOST']) {
    if (!process.env[v]) throw new RefusedError(`${v} is not set for target production`)
  }
  if (LOCAL_HOSTS.includes(process.env.POSTGRES_HOST)) {
    throw new RefusedError(`production host "${process.env.POSTGRES_HOST}" is local; refusing (misconfiguration guard)`)
  }
  if (process.env.STAGING_DB_DATABASE && process.env.STAGING_DB_DATABASE === process.env.POSTGRES_DATABASE) {
    throw new RefusedError('staging database must not be the production database (crossover refused)')
  }
  return new Sequelize({
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    host: process.env.POSTGRES_HOST,
    port: 5432,
    dialect: 'postgres',
    dialectModule: pg,
    protocol: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  })
}

// Gate 2 — database identity on the live connection.
async function verifyTargetDatabase(sequelize, expectedDatabase) {
  const [{ db }] = await sequelize.query('SELECT current_database() AS db', {
    type: sequelize.QueryTypes.SELECT
  })
  if (db !== expectedDatabase) {
    throw new RefusedError(`connected database "${db}" does not match configured target database "${expectedDatabase}"`)
  }
  return db
}

async function selectAll(sequelize, sql, options = {}) {
  return sequelize.query(sql, { type: sequelize.QueryTypes.SELECT, ...options })
}

async function tableExists(sequelize, table, transaction) {
  const rows = await selectAll(
    sequelize,
    'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = :table) AS e',
    { replacements: { table }, transaction }
  )
  return rows[0].e
}

async function columnExists(sequelize, table, column, transaction) {
  const rows = await selectAll(
    sequelize,
    'SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = :table AND column_name = :column) AS e',
    { replacements: { table, column }, transaction }
  )
  return rows[0].e
}

// CAP-002: authoritative index-shape introspection. Returns the actual
// indexed column list from pg_index/pg_attribute (NOT pg_get_indexdef text,
// which is vulnerable to substring false-positives), or null when absent.
// Expression-index entries (indkey 0) surface as nullAttrs > 0 and fail
// every exact-shape assertion below (fail closed).
async function indexShape(sequelize, indexName, transaction) {
  // One row per indexed column (ordered); avoids array-literal parsing.
  const rows = await selectAll(
    sequelize,
    `SELECT n.nspname AS "schema", c.relname AS "table", ic.relname AS name,
            i.indisunique AS "unique", a.attname AS column
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indrelid
     JOIN pg_class ic ON ic.oid = i.indexrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
     LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
     WHERE n.nspname = 'public' AND ic.relname = :name
     ORDER BY k.ord`,
    { replacements: { name: indexName }, transaction }
  )
  if (rows.length === 0) return null
  const first = rows[0]
  return {
    schema: first.schema,
    table: first.table,
    name: first.name,
    unique: first.unique,
    columns: rows.map((r) => r.column),
    nullAttrs: rows.filter((r) => r.column === null).length
  }
}

// CAP-002: exact-shape assertion. schema/table/name/uniqueness/ordered
// column list must ALL match; any deviation (extra, missing, different, or
// expression column) fails closed. No substring matching anywhere.
function assertIndexShape(found, expected) {
  const where = `postcondition failed: index ${expected.name} shape mismatch`
  if (!found) throw new ApplyError(`postcondition failed: index missing after apply: ${expected.name}`)
  if (found.schema !== expected.schema || found.table !== expected.table || found.name !== expected.name) {
    throw new ApplyError(`${where}: expected ${expected.schema}.${expected.table}.${expected.name}, found ${found.schema}.${found.table}.${found.name}`)
  }
  if (found.unique !== expected.unique) {
    throw new ApplyError(`${where}: expected unique=${expected.unique}, found unique=${found.unique}`)
  }
  if (found.nullAttrs !== 0) {
    throw new ApplyError(`${where}: index contains expression entries, expected plain columns ${JSON.stringify(expected.columns)}`)
  }
  if (JSON.stringify(found.columns) !== JSON.stringify(expected.columns)) {
    throw new ApplyError(`${where}: expected columns ${JSON.stringify(expected.columns)}, found ${JSON.stringify(found.columns)}`)
  }
}

// Gate 6 — migration-specific read-only preconditions. Returns a checks
// array; throws RefusedError on the first failing check (fail closed).
async function runPreconditions(sequelize, kind, transaction) {
  const checks = []
  const record = (name, passed, detail) => {
    checks.push({ name, passed, detail: String(detail) })
    if (!passed) throw new RefusedError(`precondition failed: ${name} — ${detail}`)
  }
  if (kind === 'region-indexes') {
    record('region.table-exists', await tableExists(sequelize, 'region', transaction), 'region table must exist (controlled apply never creates tables)')
    for (const col of ['code', 'level', 'parentCode']) {
      record(`region.column-${col}`, await columnExists(sequelize, 'region', col, transaction), `column region.${col} must exist`)
    }
    const dupes = await selectAll(
      sequelize,
      'SELECT code, COUNT(*) AS c FROM region GROUP BY code HAVING COUNT(*) > 1 LIMIT 5',
      { transaction }
    )
    record('region.code-unique', dupes.length === 0, dupes.length === 0 ? '0 duplicate code groups' : `duplicate codes: ${dupes.map((d) => d.code).join(',')}`)
  } else if (kind === 'product-review-indexes') {
    record('product_review.table-exists', await tableExists(sequelize, 'product_review', transaction), 'product_review table must exist (controlled apply never creates tables)')
    for (const col of ['productId', 'store']) {
      record(`product_review.column-${col}`, await columnExists(sequelize, 'product_review', col, transaction), `column product_review.${col} must exist`)
    }
    // The two pending indexes are deliberately NON-unique lookup indexes:
    // no duplicate precondition applies (documented NOT APPLICABLE).
    checks.push({ name: 'product_review.duplicates', passed: true, detail: 'NOT APPLICABLE — pending indexes are non-unique lookups' })
  } else if (kind === 'split-bill-hardening') {
    record('split_bill.table-exists', await tableExists(sequelize, 'split_bill', transaction), 'split_bill table must exist')
    record('split_bill.column-status', await columnExists(sequelize, 'split_bill', 'status', transaction), 'column split_bill.status must exist')
    const nulls = await selectAll(sequelize, 'SELECT COUNT(*) AS c FROM split_bill WHERE status IS NULL', { transaction })
    record('split_bill.status-not-null', Number(nulls[0].c) === 0, `${nulls[0].c} NULL status row(s)`)
    if (await tableExists(sequelize, 'order', transaction)) {
      const orphans = await selectAll(
        sequelize,
        'SELECT COUNT(*) AS c FROM split_bill sb LEFT JOIN "order" o ON o.id = sb."order" WHERE sb."order" IS NOT NULL AND o.id IS NULL',
        { transaction }
      )
      record('split_bill.order-orphans', Number(orphans[0].c) === 0, `${orphans[0].c} orphan row(s)`)
      checks.push({ name: 'split_bill.order-table', passed: true, detail: 'order table present; FK assumption holds' })
    } else {
      record('split_bill.order-table', false, '"order" table absent; FK target assumption violated')
    }
  } else {
    throw new RefusedError(`unknown controlled-apply kind "${kind}"`)
  }
  return checks
}

// Gate 10 + Gate 11 — missing-effects DDL plus in-transaction postcondition.
// Must run inside the caller's transaction; throws ApplyError on failure
// (caller rolls back; disposition untouched).
async function applyMissingEffects(sequelize, kind, transaction) {
  const applied = []
  await sequelize.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`, { transaction })
  if (kind === 'region-indexes') {
    for (const idx of REGION_INDEXES) {
      const unique = idx.unique ? 'UNIQUE ' : ''
      const cols = idx.columns.map((c) => `"${c}"`).join(', ')
      await sequelize.query(`CREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON "region" (${cols})`, { transaction })
      applied.push(idx.name)
    }
    for (const idx of REGION_INDEXES) {
      assertIndexShape(await indexShape(sequelize, idx.name, transaction), {
        schema: 'public',
        table: 'region',
        name: idx.name,
        unique: idx.unique,
        columns: [...idx.columns]
      })
    }
  } else if (kind === 'product-review-indexes') {
    for (const idx of PRODUCT_REVIEW_INDEXES) {
      const cols = idx.columns.map((c) => `"${c}"`).join(', ')
      await sequelize.query(`CREATE INDEX IF NOT EXISTS "${idx.name}" ON "product_review" (${cols})`, { transaction })
      applied.push(idx.name)
    }
    for (const idx of PRODUCT_REVIEW_INDEXES) {
      const found = await indexShape(sequelize, idx.name, transaction)
      // Guard: the pending indexes must NEVER be unique (lookup-only by design).
      assertIndexShape(found, {
        schema: 'public',
        table: 'product_review',
        name: idx.name,
        unique: false,
        columns: [...idx.columns]
      })
    }
  } else if (kind === 'split-bill-hardening') {
    // Re-check the NULL guard inside the write transaction (race safety):
    // rows committed between the Gate-6 scan and this transaction refuse here.
    const nulls = await selectAll(sequelize, 'SELECT COUNT(*) AS c FROM split_bill WHERE status IS NULL', { transaction })
    if (Number(nulls[0].c) > 0) {
      throw new RefusedError(`precondition failed: ${nulls[0].c} split_bill NULL status row(s) at apply time`)
    }
    await sequelize.query('ALTER TABLE "split_bill" ALTER COLUMN "status" SET NOT NULL', { transaction })
    applied.push('split_bill.status SET NOT NULL')
    await sequelize.query('ALTER TABLE "split_bill" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255)', { transaction })
    applied.push('split_bill.idempotencyKey column')
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "${SPLIT_BILL_INDEX.name}" ON "split_bill" ("order", "idempotencyKey")`,
      { transaction }
    )
    applied.push(SPLIT_BILL_INDEX.name)
    const nullable = await selectAll(
      sequelize,
      'SELECT is_nullable FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = \'split_bill\' AND column_name = \'status\'',
      { transaction }
    )
    if (!nullable.length || nullable[0].is_nullable !== 'NO') {
      throw new ApplyError('postcondition failed: split_bill.status is still nullable')
    }
    if (!(await columnExists(sequelize, 'split_bill', 'idempotencyKey', transaction))) {
      throw new ApplyError('postcondition failed: split_bill.idempotencyKey missing after apply')
    }
    const found = await indexShape(sequelize, SPLIT_BILL_INDEX.name, transaction)
    // Non-unique by design (one idempotencyKey covers a multi-row batch).
    assertIndexShape(found, {
      schema: 'public',
      table: 'split_bill',
      name: SPLIT_BILL_INDEX.name,
      unique: false,
      columns: [...SPLIT_BILL_INDEX.columns]
    })
  } else {
    throw new RefusedError(`unknown controlled-apply kind "${kind}"`)
  }
  return applied
}

// CAP-003 Layer 1 — cross-process serialization. Fixed, namespaced 64-bit
// advisory-lock key (two 32-bit halves) derived from
// 'controlled-apply-production/v1'. Deliberately NOT derived from the
// migration filename: every controlled apply mutates the same manifest, so
// every controlled apply must serialize against every other one — including
// across operator machines, where filesystem locks cannot reach.
function advisoryLockKeys() {
  const h = crypto.createHash('sha256').update('controlled-apply-production/v1').digest()
  return Object.freeze([h.readInt32BE(0), h.readInt32BE(4)])
}

async function acquireAdvisoryLock(sequelize, session, timeoutMs) {
  const keys = advisoryLockKeys()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const rows = await sequelize.query('SELECT pg_try_advisory_lock(:k1, :k2) AS locked', {
      replacements: { k1: keys[0], k2: keys[1] },
      type: sequelize.QueryTypes.SELECT,
      transaction: session
    })
    if (rows.length > 0 && (rows[0].locked === true || rows[0].locked === 't')) return keys
    if (Date.now() >= deadline) {
      throw new RefusedError('timed out waiting for the controlled-apply advisory lock (another controlled apply may be running); refusing without mutation')
    }
    await new Promise((resolve) => setTimeout(resolve, ADVISORY_LOCK_POLL_MS))
  }
}

async function releaseAdvisoryLock(sequelize, session, keys) {
  try {
    await sequelize.query('SELECT pg_advisory_unlock(:k1, :k2)', {
      replacements: { k1: keys[0], k2: keys[1] },
      type: sequelize.QueryTypes.SELECT,
      transaction: session
    })
  } catch {
    // Best effort: session termination already releases the lock server-side.
  }
}

// CAP-003 Layer 2 — Gate 12 compare-and-swap manifest transition.
// The critical difference from a plain write: the final disposition is
// computed from the FRESHLY RE-READ file content, never from the caller's
// (possibly stale) in-memory manifest. expectedSha is the SHA authorized
// for this execution — it is compared, never replaced, so a changed
// authorization boundary refuses instead of being silently re-authorized.
// No automatic retry: a refusal means the operator re-invokes the command.
// _hooks is test-only fault/barrier injection (never set by main()).
async function casUpdateManifestRow({ manifestPath, expectedSha, migration, applyRef, files, environment, _hooks = {} }) {
  const currentBytes = fs.readFileSync(manifestPath)
  const currentSha = crypto.createHash('sha256').update(currentBytes).digest('hex')
  if (currentSha !== expectedSha) {
    throw new RefusedError(`manifest changed since authorization (expected sha256 ${expectedSha}, found ${currentSha}); refusing stale manifest write`)
  }
  let manifest
  try {
    manifest = JSON.parse(currentBytes.toString('utf8'))
  } catch (err) {
    throw new RefusedError(`manifest is not valid JSON at CAS time: ${err.message}`)
  }
  const validation = rules.validateDispositionManifest(manifest, { files, environment })
  if (!validation.ok) {
    throw new RefusedError(`manifest invalid at CAS time — ${validation.errors.join('; ')}`)
  }
  const row = manifest.migrations.find((r) => r.migration === migration)
  if (!row) throw new RefusedError(`migration "${migration}" has no manifest row at CAS time`)
  if (row.disposition !== rules.DISPOSITIONS.CONTROLLED_APPLY_PENDING) {
    throw new RefusedError(`migration "${migration}" is ${row.disposition}, not CONTROLLED_APPLY_PENDING; refusing stale manifest write`)
  }
  if (_hooks.casAfterRead) await _hooks.casAfterRead()
  const next = {
    ...manifest,
    migrations: manifest.migrations.map((r) =>
      r.migration === migration ? { ...r, disposition: rules.DISPOSITIONS.CONTROLLED_APPLIED, applyRef } : r
    )
  }
  const revalidation = rules.validateDispositionManifest(next, { files, environment })
  if (!revalidation.ok) {
    throw new ApplyError(`manifest re-validation failed after ledger update — ${revalidation.errors.join('; ')}`)
  }
  // Narrow-window guard: re-verify the file is untouched between the CAS
  // read and this write. Concurrent tool writers are already serialized by
  // the advisory lock; this fails closed on out-of-band modification.
  const preWriteSha = sha256OfFile(manifestPath)
  if (preWriteSha !== expectedSha) {
    throw new RefusedError(`manifest changed since authorization (expected sha256 ${expectedSha}, found ${preWriteSha}); refusing stale manifest write`)
  }
  const tmp = `${manifestPath}.tmp.${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
  fs.renameSync(tmp, manifestPath)
  return next
}

function buildApplyRef(migration, operator, nowMs) {
  return `controlled-apply/${migration}/${new Date(nowMs).toISOString()}/${operator}`
}

/**
 * Core routine (also used by tests with an injected sequelize + temp
 * manifest; production wiring happens in main() only).
 */
async function runControlledApply({
  sequelize,
  expectedDatabase,
  manifestPath,
  manifest,
  files,
  environment = 'production',
  migration,
  authorizationRef,
  backupEvidencePath,
  manifestSha,
  // _confirm is enforced in parseArgs (Gate 9); the core re-checks the
  // manifest row state instead of re-validating CLI input.
  _confirm = null,
  apply = false,
  operator,
  nowMs = Date.now(),
  log = () => {},
  // CAP-003 test-only injection (never set by main()): deterministic
  // rendezvous hooks and a bounded lock-wait override. Production always
  // uses the defaults (no hooks, 10s lock wait, no auto-retry).
  _hooks = {},
  _lockTimeoutMs = ADVISORY_LOCK_TIMEOUT_MS
}) {
  const startedAt = new Date(nowMs).toISOString()
  const kind = ALLOWLIST[migration].kind
  // Gate 4 re-asserted inside the core (defense in depth): the manifest row
  // must still be PENDING at execution time, so a second apply of an
  // already-applied row is impossible even if the CLI gate was bypassed.
  // NOTE (CAP-003): this reads the process-startup snapshot only. The
  // authoritative concurrency checks run after the advisory lock is
  // acquired, on freshly re-read file state (see below).
  const row = manifest.migrations.find((r) => r.migration === migration)
  if (!row) throw new RefusedError(`migration "${migration}" has no manifest row`)
  if (row.disposition !== rules.DISPOSITIONS.CONTROLLED_APPLY_PENDING) {
    throw new RefusedError(`migration "${migration}" disposition is ${row.disposition}, not CONTROLLED_APPLY_PENDING`)
  }
  // Gate 7 runs before Gate 6 so a missing backup refuses without scanning.
  const backup = verifyBackupEvidence({ evidencePath: backupEvidencePath, expectedDatabase, manifestSha, nowMs })
  if (!apply) {
    // Gate 6 — read-only precondition scan. Dry-run writes nothing and takes
    // no lock (nothing to serialize).
    const preTx = await sequelize.transaction()
    let dryPreconditions
    try {
      await sequelize.query('SET TRANSACTION READ ONLY', { transaction: preTx })
      dryPreconditions = await runPreconditions(sequelize, kind, preTx)
      await preTx.rollback()
    } catch (err) {
      try { await preTx.rollback() } catch {}
      throw err
    }
    const dryEndedAt = new Date().toISOString()
    return {
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      outcome: 'dry-run-ok',
      mode: 'dry-run',
      authorizedManifestSha: manifestSha,
      resultingManifestSha: null,
      migration,
      kind,
      environment,
      databaseIdentity: expectedDatabase,
      operator,
      authorizationRef,
      backupRef: backup.backupRef,
      startedAt,
      endedAt: dryEndedAt,
      preconditions: dryPreconditions,
      applied: [],
      postcondition: 'not-executed-dry-run',
      dispositionBefore: 'CONTROLLED_APPLY_PENDING',
      dispositionAfter: 'CONTROLLED_APPLY_PENDING',
      applyRef: null,
      status: 'ok'
    }
  }
  // CAP-003 apply phase. Everything below runs on ONE pinned PostgreSQL
  // session that holds the cross-process advisory lock from acquisition
  // until the CAS manifest write completes (lock scope: re-check,
  // preconditions, write transaction, commit, CAS, release).
  const sessionId = `controlled-apply-${process.pid}-${nowMs}`
  const conn = await sequelize.connectionManager.getConnection({ uuid: sessionId })
  conn.uuid = sessionId
  // Session-routing handle (deliberately NOT a Sequelize Transaction: a real
  // Transaction acquires its own pooled connection and releases it at
  // commit, which would drop the session lock before the CAS write.
  // BEGIN/COMMIT/ROLLBACK are issued explicitly below on this session).
  const session = { connection: conn }
  let lockKeys = null
  const releaseSession = async () => {
    if (lockKeys) {
      await releaseAdvisoryLock(sequelize, session, lockKeys)
      lockKeys = null
    }
    conn.uuid = undefined
    sequelize.connectionManager.releaseConnection(conn)
  }
  let preconditions = []
  let applied = []
  let applyRef = null
  let resultingManifestSha = null
  try {
    lockKeys = await acquireAdvisoryLock(sequelize, session, _lockTimeoutMs)
    if (_hooks.afterLockAcquire) await _hooks.afterLockAcquire()
    // CAP-003 Invariant 4: the startup snapshot is no longer authoritative.
    // Re-read the manifest from disk and require the authorized SHA plus a
    // still-PENDING target row BEFORE opening any write transaction.
    const freshBytes = fs.readFileSync(manifestPath)
    const freshSha = crypto.createHash('sha256').update(freshBytes).digest('hex')
    if (freshSha !== manifestSha) {
      throw new RefusedError(`manifest changed since authorization (expected sha256 ${manifestSha}, found ${freshSha}); refusing before mutation`)
    }
    const fresh = JSON.parse(freshBytes.toString('utf8'))
    const freshRow = fresh.migrations.find((r) => r.migration === migration)
    if (!freshRow || freshRow.disposition !== rules.DISPOSITIONS.CONTROLLED_APPLY_PENDING) {
      throw new RefusedError(`migration "${migration}" is ${freshRow ? freshRow.disposition : 'absent'}, not CONTROLLED_APPLY_PENDING (concurrent transition); refusing before mutation`)
    }
    if (_hooks.beforeWriteTx) await _hooks.beforeWriteTx()
    // Gate 6 — read-only precondition scan on the locked session.
    await sequelize.query('BEGIN', { transaction: session })
    try {
      await sequelize.query('SET TRANSACTION READ ONLY', { transaction: session })
      preconditions = await runPreconditions(sequelize, kind, session)
      await sequelize.query('ROLLBACK', { transaction: session })
    } catch (err) {
      try { await sequelize.query('ROLLBACK', { transaction: session }) } catch {}
      throw err
    }
    // Gates 10 + 11 — write transaction on the SAME locked session.
    await sequelize.query('BEGIN', { transaction: session })
    try {
      applied = await applyMissingEffects(sequelize, kind, session)
      await sequelize.query('COMMIT', { transaction: session })
    } catch (err) {
      try { await sequelize.query('ROLLBACK', { transaction: session }) } catch {}
      throw err
    }
    if (_hooks.afterCommitBeforeCas) await _hooks.afterCommitBeforeCas()
    // Gate 12 — CAS ledger transition on freshly re-read file state, while
    // the advisory lock is still held. Only then report success.
    applyRef = buildApplyRef(migration, operator, nowMs)
    await casUpdateManifestRow({ manifestPath, expectedSha: manifestSha, migration, applyRef, files, environment, _hooks })
    // INV-004-04: measure the resulting manifest SHA from the post-CAS file
    // bytes (still under the advisory lock). Never derived from memory.
    resultingManifestSha = sha256OfFile(manifestPath)
    log(`manifest row ${migration}: CONTROLLED_APPLY_PENDING -> CONTROLLED_APPLIED (${applyRef})`)
  } finally {
    await releaseSession()
  }
  const endedAt = new Date().toISOString()
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    outcome: 'applied',
    mode: 'apply',
    authorizedManifestSha: manifestSha,
    resultingManifestSha,
    migration,
    kind,
    environment,
    databaseIdentity: expectedDatabase,
    operator,
    authorizationRef,
    backupRef: backup.backupRef,
    startedAt,
    endedAt,
    preconditions,
    applied,
    postcondition: 'verified-in-transaction',
    dispositionBefore: 'CONTROLLED_APPLY_PENDING',
    dispositionAfter: rules.DISPOSITIONS.CONTROLLED_APPLIED,
    applyRef,
    status: 'ok'
  }
}

async function main(argv = process.argv.slice(2)) {
  let sequelize
  try {
    const opts = parseArgs(argv)
    // CAP-001: production execution is permanently bound to the canonical
    // production manifest. No CLI input influences this path.
    const manifestPath = resolveProductionManifestPath()
    // INV-004-01: the evidence destination must never resolve to the
    // production manifest. Refused here, before any manifest read, DB
    // connection, or mutation of any kind.
    if (opts.evidenceOut && evidenceOutTargetsManifest({ manifestPath, evidenceOut: opts.evidenceOut })) {
      throw new RefusedError('--evidence-out must not target the production manifest (evidence output would destroy the authorization ledger)')
    }
    const { manifest, errors } = rules.readDispositionManifest(manifestPath)
    if (errors.length > 0) throw new RefusedError(errors.join('; '))
    const files = discoverMigrationFiles()
    // Gates 3+4 (+5 already in parseArgs) run before any connection opens.
    verifyManifestRow({
      manifest,
      manifestPath,
      files,
      environment: 'production',
      migration: opts.migration,
      authorizeSha256: opts.authorizeSha256,
      apply: opts.apply
    })
    const manifestSha = sha256OfFile(manifestPath)
    if (opts.apply && manifestSha !== opts.authorizeSha256) {
      throw new RefusedError(`manifest sha256 ${manifestSha} does not match the authorized sha256`)
    }
    sequelize = buildProductionSequelize()
    const expectedDatabase = process.env.POSTGRES_DATABASE
    // Gate 2 on the live connection.
    const db = await verifyTargetDatabase(sequelize, expectedDatabase)
    const evidence = await runControlledApply({
      sequelize,
      expectedDatabase,
      manifestPath,
      manifest,
      files,
      environment: 'production',
      migration: opts.migration,
      authorizationRef: opts.authorizationRef,
      backupEvidencePath: opts.backupEvidence,
      manifestSha,
      confirm: opts.confirm,
      apply: opts.apply,
      operator: opts.operator,
      log: (m) => console.log(`[controlled-apply] ${m}`)
    })
    if (db !== evidence.databaseIdentity) throw new RefusedError('database identity drifted during execution')
    // INV-004-02: successful evidence is contract-validated before it is
    // persisted or reported. (A validation failure here throws loudly; full
    // apply/persistence outcome separation is a later CAP-004 increment.)
    const evidenceValidation = validateApplyEvidence(evidence)
    if (!evidenceValidation.ok) {
      throw new ApplyError(`produced evidence failed contract validation — ${evidenceValidation.errors.join('; ')}`)
    }
    const out = JSON.stringify(evidence, null, 2)
    if (opts.evidenceOut) writeEvidenceOut(opts.evidenceOut, evidence)
    console.log(out)
    if (!opts.apply) console.log('[controlled-apply] DRY-RUN: nothing written.')
    else console.log('[controlled-apply] APPLIED. Manifest re-approval is now required (SHA changed). Re-run `npm run check:production-schema`.')
    process.exitCode = 0
  } catch (err) {
    console.error(err instanceof RefusedError || err instanceof ApplyError ? err.message : `[controlled-apply] ERROR: ${err.message}`)
    process.exitCode = 1
  } finally {
    if (sequelize) {
      try { await sequelize.close() } catch {}
    }
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  RefusedError,
  ApplyError,
  ALLOWLIST,
  REGION_INDEXES,
  PRODUCT_REVIEW_INDEXES,
  SPLIT_BILL_INDEX,
  BACKUP_MAX_AGE_MS,
  parseArgs,
  resolveProductionManifestPath,
  verifyManifestRow,
  verifyBackupEvidence,
  verifyTargetDatabase,
  runPreconditions,
  indexShape,
  assertIndexShape,
  applyMissingEffects,
  advisoryLockKeys,
  ADVISORY_LOCK_TIMEOUT_MS,
  ADVISORY_LOCK_POLL_MS,
  casUpdateManifestRow,
  EVIDENCE_SCHEMA_VERSION,
  evidenceOutTargetsManifest,
  validateApplyEvidence,
  writeEvidenceOut,
  buildApplyRef,
  runControlledApply,
  main
}
