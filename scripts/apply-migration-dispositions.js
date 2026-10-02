'use strict'

/**
 * W-01.1 — migration disposition stamper.
 *
 * Records every migration listed in the reviewed disposition manifest into
 * SequelizeMeta WITHOUT executing it (D-02, Model D: SequelizeMeta is the
 * runner's DO-NOT-EXECUTE ledger). After stamping, `sequelize-cli db:migrate`
 * can never replay an attested / excluded / controlled / blocked migration.
 *
 * Safety contract:
 *   - DRY-RUN BY DEFAULT. A dry run reads inside a READ ONLY transaction and
 *     reports what would be inserted. Nothing is written.
 *   - Mutation requires ALL of: --target <env> (explicit, no default),
 *     --apply, --authorize-manifest-sha256=<sha256 of the exact manifest file
 *     bytes>, and an APPROVED manifest (approvedBy/approvedAt set). The
 *     sha256 binds the authorization to the reviewed content; it is not a
 *     credential and no secret is introduced.
 *   - INSERT only. Never UPDATE or DELETE. Existing rows are left untouched.
 *   - Single transaction with the ledger table locked; the expected final
 *     set is re-read and verified before COMMIT; any failure rolls back.
 *   - Refuses malformed manifests, unknown/duplicate rows, orphan or
 *     duplicate SequelizeMeta rows, and a connected database whose name does
 *     not match the configured target.
 *   - Idempotent: a second run inserts nothing.
 *
 * This script is NEVER run by CI and is never invoked by the migration
 * runner. Production stamping is a separately authorized operational action.
 */

const path = require('path')
const rules = require('./migration-dispositions')

const ROOT = path.join(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations')
const META_TABLE = 'SequelizeMeta'
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const MANIFEST_BY_TARGET = Object.freeze({ production: rules.PRODUCTION_DISPOSITIONS_PATH })

class RefusedError extends Error {
  constructor(message) {
    super(`[dispositions] REFUSED: ${message}`)
    this.name = 'RefusedError'
  }
}

function discoverMigrationFiles(dir = MIGRATIONS_DIR) {
  return require('fs')
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
}

// CLI parsing. Unknown flags are refused (fail closed).
function parseArgs(argv) {
  const opts = { target: null, apply: false, authorizeSha256: null }
  for (const arg of argv) {
    if (arg === '--apply') opts.apply = true
    else if (arg.startsWith('--target=')) opts.target = arg.slice('--target='.length)
    else if (arg.startsWith('--authorize-manifest-sha256=')) {
      opts.authorizeSha256 = arg.slice('--authorize-manifest-sha256='.length)
    } else throw new RefusedError(`unknown argument "${arg}"`)
  }
  if (!opts.target) throw new RefusedError('--target=<environment> is required (no default)')
  if (!MANIFEST_BY_TARGET[opts.target]) {
    throw new RefusedError(`no disposition manifest exists for target "${opts.target}"`)
  }
  if (opts.authorizeSha256 && !opts.apply) {
    throw new RefusedError('--authorize-manifest-sha256 is only meaningful with --apply')
  }
  if (opts.apply && !/^[0-9a-f]{64}$/.test(opts.authorizeSha256 || '')) {
    throw new RefusedError('--apply requires --authorize-manifest-sha256=<64-hex sha256 of the manifest file>')
  }
  return opts
}

async function readMeta(sequelize, metaTable, transaction) {
  const rows = await sequelize.query(`SELECT name FROM "${metaTable}" ORDER BY name`, {
    transaction,
    type: (sequelize.QueryTypes || require('sequelize').QueryTypes).SELECT
  })
  return rows.map((r) => r.name)
}

/**
 * Core stamping routine (also used by tests against the test database).
 * Returns { mode, toInsert, inserted, alreadyRecorded, metaBefore, metaAfter }.
 */
async function stampDispositions({
  sequelize,
  manifest,
  files,
  environment,
  apply = false,
  metaTable = META_TABLE,
  log = () => {}
}) {
  if (!IDENTIFIER.test(metaTable)) throw new RefusedError(`invalid ledger table name "${metaTable}"`)
  const validation = rules.validateDispositionManifest(manifest, { files, environment })
  if (!validation.ok) {
    throw new RefusedError(`manifest invalid — ${validation.errors.join('; ')}`)
  }
  if (apply && !validation.approved) {
    throw new RefusedError('manifest is not approved (approvedBy/approvedAt pending); mutation refused')
  }
  const fileSet = new Set(files)
  const transaction = await sequelize.transaction()
  try {
    if (apply) {
      // Serialize against concurrent writers of the ledger for this transaction.
      await sequelize.query(`LOCK TABLE "${metaTable}" IN SHARE ROW EXCLUSIVE MODE`, { transaction })
    } else {
      await sequelize.query('SET TRANSACTION READ ONLY', { transaction })
    }
    const before = await readMeta(sequelize, metaTable, transaction)
    const orphans = before.filter((n) => !fileSet.has(n))
    if (orphans.length > 0) {
      throw new RefusedError(`${metaTable} has rows with no migration file: ${orphans.join(', ')}`)
    }
    const dupes = [...new Set(before.filter((n, i) => before.indexOf(n) !== i))]
    if (dupes.length > 0) throw new RefusedError(`${metaTable} has duplicate rows: ${dupes.join(', ')}`)

    const beforeSet = new Set(before)
    const toInsert = validation.names.filter((n) => !beforeSet.has(n))
    const alreadyRecorded = validation.names.length - toInsert.length
    log(`manifest rows=${validation.names.length} alreadyRecorded=${alreadyRecorded} toInsert=${toInsert.length}`)

    if (!apply) {
      await transaction.rollback()
      return { mode: 'dry-run', toInsert, inserted: [], alreadyRecorded, metaBefore: before.length, metaAfter: before.length }
    }

    if (toInsert.length > 0) {
      const values = toInsert.map((_, i) => `($${i + 1})`).join(', ')
      await sequelize.query(`INSERT INTO "${metaTable}" (name) VALUES ${values}`, {
        bind: toInsert,
        transaction
      })
    }

    // Verify the expected final set inside the same transaction.
    const after = await readMeta(sequelize, metaTable, transaction)
    const expected = [...new Set([...before, ...toInsert])].sort()
    if (JSON.stringify(after) !== JSON.stringify(expected)) {
      throw new Error('post-insert verification failed: ledger content differs from the expected set')
    }
    const afterSet = new Set(after)
    const unrecorded = validation.names.filter((n) => !afterSet.has(n))
    if (unrecorded.length > 0) {
      throw new Error(`post-insert verification failed: not recorded: ${unrecorded.join(', ')}`)
    }
    await transaction.commit()
    return { mode: 'apply', toInsert, inserted: toInsert, alreadyRecorded, metaBefore: before.length, metaAfter: after.length }
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {}
    throw err
  }
}

function buildProductionSequelize() {
  // Same connection shape as scripts/check-production-schema.js.
  require('dotenv').config({ path: `${process.cwd()}/.env.production` })
  const { Sequelize } = require('sequelize')
  const pg = require('pg')
  for (const v of ['POSTGRES_USER', 'POSTGRES_DATABASE', 'POSTGRES_HOST']) {
    if (!process.env[v]) throw new RefusedError(`${v} is not set for target production`)
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

async function main(argv = process.argv.slice(2)) {
  let sequelize
  try {
    const opts = parseArgs(argv)
    const manifestPath = MANIFEST_BY_TARGET[opts.target]
    const { manifest, errors } = rules.readDispositionManifest(manifestPath)
    if (errors.length > 0) throw new RefusedError(errors.join('; '))
    if (opts.apply) {
      const actual = rules.sha256OfFile(manifestPath)
      if (actual !== opts.authorizeSha256) {
        throw new RefusedError(`manifest sha256 ${actual} does not match the authorized sha256`)
      }
    }
    // Validate (and, for --apply, require approval) BEFORE any connection is
    // opened, so a refusal never contacts the target database.
    const files = discoverMigrationFiles()
    const validation = rules.validateDispositionManifest(manifest, { files, environment: opts.target })
    if (!validation.ok) throw new RefusedError(`manifest invalid — ${validation.errors.join('; ')}`)
    if (opts.apply && !validation.approved) {
      throw new RefusedError('manifest is not approved (approvedBy/approvedAt pending); mutation refused')
    }
    sequelize = buildProductionSequelize()
    const [{ db }] = await sequelize.query('SELECT current_database() AS db', {
      type: (sequelize.QueryTypes || require('sequelize').QueryTypes).SELECT
    })
    if (db !== process.env.POSTGRES_DATABASE) {
      throw new RefusedError(`connected database "${db}" does not match configured target database`)
    }
    const result = await stampDispositions({
      sequelize,
      manifest,
      files,
      environment: opts.target,
      apply: opts.apply,
      log: (m) => console.log(`[dispositions] ${m}`)
    })
    if (result.mode === 'dry-run') {
      console.log(`[dispositions] DRY-RUN: nothing written. Would record ${result.toInsert.length} migration(s) in SequelizeMeta.`)
      for (const n of result.toInsert) console.log(`  + ${n}`)
    } else {
      console.log(`[dispositions] APPLIED: recorded ${result.inserted.length} migration(s); ledger ${result.metaBefore} -> ${result.metaAfter}.`)
      console.log('[dispositions] Re-run `npm run check:production-schema` and retain both outputs as evidence.')
    }
    process.exitCode = 0
  } catch (err) {
    console.error(err instanceof RefusedError ? err.message : `[dispositions] ERROR: ${err.message}`)
    process.exitCode = 1
  } finally {
    if (sequelize) {
      try {
        await sequelize.close()
      } catch {}
    }
  }
}

if (require.main === module) {
  main()
}

module.exports = { RefusedError, META_TABLE, parseArgs, stampDispositions, discoverMigrationFiles, main }
