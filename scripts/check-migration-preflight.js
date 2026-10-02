'use strict'

/**
 * W-01.1 — migration runner preflight (fail closed).
 *
 * Must pass BEFORE `sequelize-cli db:migrate` is started (scripts/run-migrations.js
 * runs it in-process and only then spawns the runner). It never starts the
 * runner itself and never writes.
 *
 * Target resolution mirrors sequelize-cli: --env flag, else NODE_ENV, else
 * "development"; connection settings come from config/config.js[env].
 *
 * production (a disposition manifest exists for it):
 *   1. the disposition manifest is readable, valid and approved;
 *   2. every manifest migration is already recorded in SequelizeMeta, so the
 *      runner can never replay an attested/excluded/controlled/blocked file;
 *   3. no BLOCKED_DECISION remains;
 *   4. no CONTROLLED_APPLY_PENDING remains;
 *   5. SequelizeMeta holds no rows without a repository file.
 * Any other environment has no production manifest; it is only allowed when
 * the configured host is local (a "development" target pointing at a remote
 * database is refused rather than guessed about).
 */

const path = require('path')
const rules = require('./migration-dispositions')

const ROOT = path.join(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations')
const LOCAL_HOSTS = Object.freeze(['localhost', '127.0.0.1', '::1'])
const MANIFEST_BY_ENV = Object.freeze({ production: rules.PRODUCTION_DISPOSITIONS_PATH })

function discoverMigrationFiles(dir = MIGRATIONS_DIR) {
  return require('fs')
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
}

// Pure decision. Returns { ok, applicable, reasons }.
function evaluatePreflight({ env, targetHost, dispositions, dispositionErrors = [], files, metaNames }) {
  const reasons = []
  if (!MANIFEST_BY_ENV[env]) {
    if (!LOCAL_HOSTS.includes(String(targetHost || '').toLowerCase())) {
      reasons.push(`environment "${env}" has no disposition manifest and targets non-local host "${targetHost || '(unset)'}"`)
    }
    return { ok: reasons.length === 0, applicable: false, reasons }
  }

  if (dispositionErrors.length > 0 || dispositions == null) {
    reasons.push(...(dispositionErrors.length ? dispositionErrors : ['disposition manifest missing']))
    return { ok: false, applicable: true, reasons }
  }
  const validation = rules.validateDispositionManifest(dispositions, { files, environment: env })
  if (!validation.ok) {
    reasons.push(...validation.errors.map((e) => `disposition manifest: ${e}`))
    return { ok: false, applicable: true, reasons }
  }
  if (!validation.approved) reasons.push('disposition manifest is not approved')
  if (!Array.isArray(metaNames)) {
    reasons.push('SequelizeMeta unreadable')
    return { ok: false, applicable: true, reasons }
  }
  const fileSet = new Set(files)
  const orphans = metaNames.filter((n) => !fileSet.has(n))
  if (orphans.length > 0) reasons.push(`SequelizeMeta rows with no migration file: ${orphans.join(', ')}`)

  const evaluation = rules.evaluateDispositions({ validation, files, metaNames })
  if (evaluation.notRecorded.length > 0) {
    reasons.push(
      `dispositions not stamped in SequelizeMeta (runner would replay them) (${evaluation.notRecorded.length}): ${evaluation.notRecorded.join(', ')}`
    )
  }
  if (evaluation.blocked.length > 0) {
    reasons.push(
      `BLOCKED_DECISION remains (${evaluation.blocked.length}): ${evaluation.blocked
        .map((b) => `${b.migration} [${b.decisionRef}]`)
        .join(', ')}`
    )
  }
  if (evaluation.controlledPending.length > 0) {
    reasons.push(
      `CONTROLLED_APPLY_PENDING remains (${evaluation.controlledPending.length}): ${evaluation.controlledPending
        .map((p) => p.migration)
        .join(', ')}`
    )
  }
  return { ok: reasons.length === 0, applicable: true, reasons }
}

function resolveEnv(argEnv) {
  return argEnv || process.env.NODE_ENV || 'development'
}

// Loads config/config.js for `env` exactly as sequelize-cli would (config.js
// selects its dotenv file from NODE_ENV at require time).
function loadTargetConfig(env) {
  process.env.NODE_ENV = env
  const configPath = path.join(ROOT, 'config', 'config.js')
  delete require.cache[require.resolve(configPath)]
  const all = require(configPath)
  const cfg = all[env]
  if (!cfg) throw new Error(`config/config.js has no "${env}" environment`)
  return cfg
}

async function readMetaReadOnly(cfg) {
  const { Sequelize } = require('sequelize')
  const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, { ...cfg, logging: false })
  const transaction = await sequelize.transaction()
  try {
    await sequelize.query('SET TRANSACTION READ ONLY', { transaction })
    const rows = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name', {
      transaction,
      type: (sequelize.QueryTypes || require('sequelize').QueryTypes).SELECT
    })
    await transaction.commit()
    return rows.map((r) => r.name)
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {}
    throw err
  } finally {
    await sequelize.close().catch(() => {})
  }
}

async function runPreflight({ env: argEnv } = {}) {
  const env = resolveEnv(argEnv)
  try {
    const cfg = loadTargetConfig(env)
    const files = discoverMigrationFiles()
    if (!MANIFEST_BY_ENV[env]) {
      return { env, ...evaluatePreflight({ env, targetHost: cfg.host, files }) }
    }
    const { manifest, errors } = rules.readDispositionManifest(MANIFEST_BY_ENV[env])
    let metaNames = null
    try {
      metaNames = await readMetaReadOnly(cfg)
    } catch (err) {
      return { env, ok: false, applicable: true, reasons: [`SequelizeMeta unreadable: ${err.message}`] }
    }
    return {
      env,
      ...evaluatePreflight({ env, targetHost: cfg.host, dispositions: manifest, dispositionErrors: errors, files, metaNames })
    }
  } catch (err) {
    return { env, ok: false, applicable: true, reasons: [`preflight error: ${err.message}`] }
  }
}

function report(result) {
  if (result.ok) {
    console.log(
      `[migration-preflight] OK for "${result.env}"${result.applicable ? ' (all dispositions stamped; no blocked or pending dispositions)' : ' (no disposition manifest applies; local target)'}`
    )
  } else {
    console.error(`[migration-preflight] REFUSED for "${result.env}" — the migration runner must not start:`)
    for (const r of result.reasons) console.error(`  - ${r}`)
  }
}

async function main(argv = process.argv.slice(2)) {
  let env = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--env' && argv[i + 1]) env = argv[++i]
    else if (a.startsWith('--env=')) env = a.slice('--env='.length)
    else {
      console.error(`[migration-preflight] REFUSED: unknown argument "${a}"`)
      process.exitCode = 1
      return
    }
  }
  const result = await runPreflight({ env })
  report(result)
  process.exitCode = result.ok ? 0 : 1
}

if (require.main === module) {
  main()
}

module.exports = { LOCAL_HOSTS, evaluatePreflight, resolveEnv, runPreflight, report, main }
