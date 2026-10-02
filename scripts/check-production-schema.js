'use strict'

/**
 * W-01 — production schema verifier (read-only release migration gate).
 *
 * Based on scripts/check-production-meta.js (production connection shape)
 * and scripts/validate-migration-chain.js (migration-baseline.txt semantics
 * + ledger assertions: count, membership, order, no duplicates).
 *
 * What it does (VERIFY only):
 *   1. Discovers repository migration files (db/migrations/*.js, sorted).
 *   2. Reads db/migration-baseline.txt (snapshot-embodied boundary; comments
 *      and blanks ignored; duplicates rejected — same rule as the chain
 *      validator). Baseline entries are provenance, NOT exemption: production
 *      must still record every file in SequelizeMeta.
 *   3. Compares SequelizeMeta (ORDER BY name) against the file set:
 *      missing/unapplied, orphans without a file, duplicates, ordering.
 *   4. Verifies November auth/tenant/audit critical schema objects/columns
 *      (user.disabledAt, authorization_context_session, tenant tables,
 *      tenant_membership.reactivatedAt, DR-20 auditLog columns).
 *   5. (W-01.1) Validates the production disposition manifest
 *      (db/migration-dispositions/production.json) and relates it to
 *      SequelizeMeta: every manifest row must be recorded, no controlled apply
 *      may be pending, and open business decisions surface as BLOCKED.
 *
 * SequelizeMeta semantics (D-02, Model D): a recorded name is one the runner
 * must never execute again. The verifier reports RECORDED state and never
 * asserts that the recorded population was executed or applied.
 *
 * What it NEVER does (no APPLY):
 *   INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, migrations, or any write to
 *   SequelizeMeta / application tables. All database reads run inside a
 *   single transaction that is explicitly set READ ONLY immediately after
 *   BEGIN, so Postgres itself rejects any write with
 *   25006 "cannot execute ... in a read-only transaction".
 *
 * Exit status (CLI): 0 PASS, 1 FAIL, 2 BLOCKED (structurally sound, but at
 * least one BLOCKED_DECISION remains — the release STOPs).
 */

const fs = require('fs')
const path = require('path')
const dispositionRules = require('./migration-dispositions')

const ROOT = path.join(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations')
const MANIFEST_PATH = path.join(ROOT, 'db', 'migration-baseline.txt')

// November baseline critical schema (exact SQL identifiers from migrations).
// Table names are case-sensitive where quoted ("auditLog").
const CRITICAL_TABLES = Object.freeze([
  'user',
  'tenant',
  'tenant_membership',
  'store_assignment',
  'authorization_context_session',
  'auditLog',
  'location'
])

const CRITICAL_COLUMNS = Object.freeze({
  user: ['disabledAt'],
  tenant: ['code', 'name', 'status'],
  tenant_membership: ['userId', 'tenantId', 'role', 'status', 'reactivatedAt'],
  store_assignment: ['userId', 'tenantId', 'storeId'],
  authorization_context_session: [
    'sessionId',
    'userId',
    'activeTenantId',
    'activeStoreId',
    'version',
    'expiresAt',
    'revokedAt'
  ],
  auditLog: ['actorType', 'tenantId', 'result', 'requestId', 'reason', 'source', 'metadata'],
  location: ['tenantId']
})

function readMigrationManifest(manifestPath = MANIFEST_PATH) {
  const lines = fs
    .readFileSync(manifestPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const dups = lines.filter((l, i) => lines.indexOf(l) !== i)
  if (dups.length > 0) {
    throw new Error(`migration baseline manifest contains duplicates: ${[...new Set(dups)].join(', ')}`)
  }
  return lines
}

function discoverMigrationFiles(migrationsDir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.js'))
    .sort()
}

function asColumnSet(value) {
  if (value instanceof Set) return value
  if (Array.isArray(value)) return new Set(value)
  return new Set()
}

function compareMigrationState({ files, manifest, metaNames }) {
  const failures = []
  const fileSet = new Set(files)
  const manifestWithoutFile = manifest.filter((m) => !fileSet.has(m))
  if (manifestWithoutFile.length > 0) {
    failures.push(
      `baseline manifest lists ${manifestWithoutFile.length} entr(y/ies) with no migration file: ${manifestWithoutFile.join(', ')}`
    )
  }
  const missingInDb = files.filter((f) => !metaNames.includes(f))
  if (missingInDb.length > 0) {
    failures.push(
      `repository migrations missing from SequelizeMeta (not recorded) (${missingInDb.length}): ${missingInDb.join(', ')}`
    )
  }
  const orphanInDb = metaNames.filter((m) => !fileSet.has(m))
  if (orphanInDb.length > 0) {
    failures.push(
      `unexpected SequelizeMeta entries with no migration file (${orphanInDb.length}): ${orphanInDb.join(', ')}`
    )
  }
  const duplicatesInDb = [...new Set(metaNames.filter((m, i) => metaNames.indexOf(m) !== i))]
  if (duplicatesInDb.length > 0) {
    failures.push(`duplicate SequelizeMeta entries: ${duplicatesInDb.join(', ')}`)
  }
  const sorted = [...metaNames].sort()
  if (JSON.stringify(sorted) !== JSON.stringify(metaNames)) {
    failures.push('SequelizeMeta ordering inconsistent (expected ORDER BY name)')
  }
  const pending = files.filter((f) => !manifest.includes(f))
  return {
    ok: failures.length === 0,
    failures,
    missingInDb,
    orphanInDb,
    duplicatesInDb,
    manifestWithoutFile,
    baselineCount: manifest.length,
    pendingCount: pending.length,
    pending
  }
}

function compareSchemaState(schema) {
  const failures = []
  for (const table of CRITICAL_TABLES) {
    const cols = schema ? schema[table] : undefined
    if (!cols) {
      failures.push(`missing table "${table}"`)
      continue
    }
    const set = asColumnSet(cols)
    for (const col of CRITICAL_COLUMNS[table] || []) {
      if (!set.has(col)) {
        failures.push(`missing column "${table}"."${col}"`)
      }
    }
  }
  return { ok: failures.length === 0, failures }
}

const STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', BLOCKED: 'BLOCKED' })
const EXIT_CODES = Object.freeze({ PASS: 0, FAIL: 1, BLOCKED: 2 })

// W-01.1: relates the production disposition manifest to SequelizeMeta.
// `dispositions` is the parsed manifest object; `dispositionErrors` carries
// read/parse errors (e.g. malformed JSON) so they fail closed here.
function compareDispositionState({ files, metaNames, dispositions, dispositionErrors = [] }) {
  const failures = dispositionErrors.map((e) => `disposition manifest: ${e}`)
  if (failures.length > 0 || dispositions == null) {
    if (failures.length === 0) failures.push('disposition manifest: missing')
    return { failures, blocked: [], validation: null, evaluation: null }
  }
  const validation = dispositionRules.validateDispositionManifest(dispositions, {
    files,
    environment: 'production'
  })
  if (!validation.ok) {
    return {
      failures: validation.errors.map((e) => `disposition manifest: ${e}`),
      blocked: [],
      validation,
      evaluation: null
    }
  }
  if (!validation.approved) {
    failures.push('disposition manifest is not approved (approvedBy/approvedAt pending review)')
  }
  const evaluation = dispositionRules.evaluateDispositions({ validation, files, metaNames })
  if (evaluation.notRecorded.length > 0) {
    failures.push(
      `disposition manifest rows not recorded in SequelizeMeta (${evaluation.notRecorded.length}): ${evaluation.notRecorded.join(', ')}`
    )
  }
  if (evaluation.controlledPending.length > 0) {
    failures.push(
      `controlled apply still pending (${evaluation.controlledPending.length}): ${evaluation.controlledPending
        .map((p) => (p.decisionRef ? `${p.migration} [${p.decisionRef}]` : p.migration))
        .join(', ')}`
    )
  }
  return { failures, blocked: evaluation.blocked, validation, evaluation }
}

function verifyFromState({ files, manifest, metaNames, schema, dispositions, dispositionErrors }) {
  const resolvedFiles = files || discoverMigrationFiles()
  const resolvedManifest = manifest || readMigrationManifest()
  if (!metaNames) {
    throw new Error('verifyFromState requires metaNames (SequelizeMeta entries ordered by name)')
  }
  if (!schema) {
    throw new Error('verifyFromState requires schema (map of table -> Set(columns))')
  }
  if (dispositions === undefined && !dispositionErrors) {
    throw new Error('verifyFromState requires dispositions (parsed production disposition manifest)')
  }
  const migration = compareMigrationState({
    files: resolvedFiles,
    manifest: resolvedManifest,
    metaNames
  })
  const schemaCheck = compareSchemaState(schema)
  const dispositionCheck = compareDispositionState({
    files: resolvedFiles,
    metaNames,
    dispositions,
    dispositionErrors
  })
  const failures = [...migration.failures, ...schemaCheck.failures, ...dispositionCheck.failures]
  const blocked = failures.length === 0 ? dispositionCheck.blocked : []
  // FAIL dominates; BLOCKED only when structurally sound with open decisions.
  const status = failures.length > 0 ? STATUS.FAIL : blocked.length > 0 ? STATUS.BLOCKED : STATUS.PASS
  return {
    status,
    exitCode: EXIT_CODES[status],
    ok: status === STATUS.PASS,
    failures,
    blocked: dispositionCheck.blocked,
    migration,
    schemaCheck,
    dispositionCheck,
    summary: dispositionCheck.evaluation
      ? dispositionRules.describeRecordedState(dispositionCheck.evaluation.counts)
      : null
  }
}

// Test helper: a schema map that satisfies every critical check (pure, no DB).
function completeTestSchema() {
  const out = {}
  for (const table of CRITICAL_TABLES) {
    out[table] = new Set([...(CRITICAL_COLUMNS[table] || []), 'id', 'createdAt', 'updatedAt'])
  }
  return out
}

// Genuinely read-only transaction: BEGIN, then SET TRANSACTION READ ONLY as
// the first statement, so Postgres rejects any subsequent write in this
// transaction (25006). All verifier reads must pass { transaction }.
async function withReadOnlyTransaction(sequelize, fn) {
  const transaction = await sequelize.transaction()
  try {
    await sequelize.query('SET TRANSACTION READ ONLY', { transaction })
    const result = await fn(transaction)
    await transaction.commit()
    return result
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {}
    throw err
  }
}

async function verifyProductionSchema(
  sequelize,
  {
    migrationsDir = MIGRATIONS_DIR,
    manifestPath = MANIFEST_PATH,
    dispositionsPath = dispositionRules.PRODUCTION_DISPOSITIONS_PATH
  } = {}
) {
  const files = discoverMigrationFiles(migrationsDir)
  const manifest = readMigrationManifest(manifestPath)
  const { manifest: dispositions, errors: dispositionErrors } =
    dispositionRules.readDispositionManifest(dispositionsPath)
  return withReadOnlyTransaction(sequelize, async (transaction) => {
    const QueryTypes = sequelize.QueryTypes || require('sequelize').QueryTypes
    let metaNames
    try {
      const rows = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name', {
        transaction,
        type: QueryTypes.SELECT
      })
      metaNames = rows.map((r) => r.name)
    } catch (err) {
      if (err && (err.original?.code === '42P01' || /does not exist|undefined table/i.test(err.message || ''))) {
        return {
          status: STATUS.FAIL,
          exitCode: EXIT_CODES.FAIL,
          ok: false,
          failures: ['missing table "SequelizeMeta" (migration history unreadable)'],
          blocked: [],
          migration: null,
          schemaCheck: null,
          dispositionCheck: null,
          summary: null
        }
      }
      throw err
    }
    const tables = [...CRITICAL_TABLES]
    const placeholders = tables.map((_, i) => `$${i + 1}`).join(',')
    // information_schema read: table/column existence only, no mutation.
    const clientRows = await sequelize.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN (${placeholders})`,
      { bind: tables, transaction, type: QueryTypes.SELECT }
    )
    const schema = {}
    for (const { table_name, column_name } of clientRows) {
      if (!schema[table_name]) schema[table_name] = new Set()
      schema[table_name].add(column_name)
    }
    // Tables with zero columns are absent from information_schema; mark only
    // present ones. Missing tables are reported by compareSchemaState.
    const result = verifyFromState({ files, manifest, metaNames, schema, dispositions, dispositionErrors })
    return {
      ...result,
      details: {
        files: files.length,
        baselineCount: manifest.length,
        pendingCount: files.length - manifest.length,
        metaCount: metaNames.length
      }
    }
  })
}

function buildProductionSequelize() {
  require('dotenv').config({ path: `${process.cwd()}/.env.production` })
  const { Sequelize } = require('sequelize')
  const pg = require('pg')
  return new Sequelize({
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    host: process.env.POSTGRES_HOST,
    port: 5432,
    dialect: 'postgres',
    dialectModule: pg,
    protocol: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    },
    logging: false
  })
}

// Pure: turns a verification result into report lines + exit code. Wording
// reports what is RECORDED; it never claims the population was executed.
function formatReport(result) {
  const out = []
  const err = []
  if (result.details) {
    out.push(
      `[schema-verifier] files=${result.details.files} baseline=${result.details.baselineCount} meta=${result.details.metaCount}`
    )
  }
  if (result.summary) out.push(`[schema-verifier] ${result.summary}`)
  if (result.status === STATUS.PASS) {
    out.push(
      '[schema-verifier] PASS: every repository migration has an authoritative record (runner-recorded or dispositioned) and the critical schema is present.'
    )
  } else if (result.status === STATUS.BLOCKED) {
    err.push('[schema-verifier] BLOCKED: structurally sound, but business decisions remain open:')
    for (const b of result.blocked) err.push(`  - ${b.migration} [${b.decisionRef}]`)
    err.push('[schema-verifier] Release STOPs until each decision is recorded in the disposition manifest.')
  } else {
    err.push('[schema-verifier] FAIL: production migration state does not satisfy the W-01.1 contract.')
    for (const f of result.failures) err.push(`  - ${f}`)
    err.push(
      '[schema-verifier] Release STOPs. Stamping dispositions and applying migrations are explicitly authorized operational actions and are NOT performed by this verifier.'
    )
  }
  return { out, err, exitCode: EXIT_CODES[result.status] ?? EXIT_CODES.FAIL }
}

async function main() {
  const sequelize = buildProductionSequelize()
  try {
    const result = await verifyProductionSchema(sequelize)
    const report = formatReport(result)
    for (const line of report.out) console.log(line)
    for (const line of report.err) console.error(line)
    process.exitCode = report.exitCode
  } catch (err) {
    console.error(`[schema-verifier] ERROR: ${err.message}`)
    process.exitCode = 1
  } finally {
    try {
      await sequelize.close()
    } catch {}
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  MIGRATIONS_DIR,
  MANIFEST_PATH,
  CRITICAL_TABLES,
  CRITICAL_COLUMNS,
  STATUS,
  EXIT_CODES,
  readMigrationManifest,
  discoverMigrationFiles,
  compareMigrationState,
  compareSchemaState,
  compareDispositionState,
  verifyFromState,
  formatReport,
  completeTestSchema,
  withReadOnlyTransaction,
  verifyProductionSchema
}
