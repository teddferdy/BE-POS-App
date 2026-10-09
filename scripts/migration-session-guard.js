'use strict'

/**
 * D-08 B3 execution guards used by scripts/run-migrations.js.
 *
 * 1. Session probe (read-only). Proves the target endpoint applies the B3
 *    session guard (lock_timeout / statement_timeout / application_name,
 *    scripts/migration-batches.js BATCH_SESSION_GUARDS) BEFORE the migration
 *    starts. It runs as a child process with exactly the environment the
 *    sequelize-cli child will get, so it exercises the same pg driver →
 *    endpoint path (PGOPTIONS / PGAPPNAME startup parameters). A pooler that
 *    rejects the startup options fails the probe; one that silently drops
 *    them reports the server defaults and fails verification. Either way the
 *    migration is never started.
 *
 * 2. Run lock. A transaction-scoped advisory lock (pg_try_advisory_xact_lock,
 *    non-blocking) held in a READ ONLY transaction for the whole guarded run,
 *    so a second guarded run refuses instead of racing the first. It takes no
 *    table lock and writes nothing. The holder transaction disables
 *    idle_in_transaction_session_timeout for itself (SET LOCAL, verified), and
 *    stillHeld() proves from pg_locks that this backend still holds exactly
 *    this key — the runner checks it before the spawn and after the child.
 *    Released by ending the transaction; if the holding connection dies,
 *    PostgreSQL releases it with the session (stillHeld() then reports it).
 *
 * Connections resolve ONLY through the preflight module passed in (its
 * loadTargetConfig); there is no implicit fallback to the real module, so a
 * stubbed preflight can never reach a real database through these guards.
 *
 * Neither guard writes to the database. Neither ever retries anything.
 */

const path = require('path')
const { spawnSync } = require('child_process')
const { D08_RUNNER_LOCK_KEYS } = require('./migration-batches')

const ROOT = path.join(__dirname, '..')
const PROBE_MARKER = '[migration-session-probe] '
const PROBE_TIMEOUT_MS = 60000

function connect(env, preflight) {
  if (!preflight || typeof preflight.loadTargetConfig !== 'function' || typeof preflight.resolveEnv !== 'function') {
    throw new Error('guard dependency missing: preflight.loadTargetConfig/resolveEnv — refusing to resolve a database connection')
  }
  const cfg = preflight.loadTargetConfig(preflight.resolveEnv(env))
  const { Sequelize } = require('sequelize')
  // One dedicated connection: the probe must read the session it opened, and
  // the lock must live on exactly one connection.
  return new Sequelize(cfg.database, cfg.username, cfg.password, {
    ...cfg,
    logging: false,
    pool: { max: 1, min: 0, acquire: 30000, idle: 10000 }
  })
}

const UNIT_MS = Object.freeze({ ms: 1, s: 1000, min: 60000 })

function settingMs(row) {
  if (!row || !Object.prototype.hasOwnProperty.call(UNIT_MS, row.unit)) return null
  const n = Number(row.setting)
  return Number.isFinite(n) ? n * UNIT_MS[row.unit] : null
}

// What the server applied to this connection (pg_settings reflects the
// session's effective values, including startup-parameter overrides).
async function readSessionSettings(env, { preflight } = {}) {
  const sequelize = connect(env, preflight)
  const SELECT = (sequelize.QueryTypes || require('sequelize').QueryTypes).SELECT
  const transaction = await sequelize.transaction()
  try {
    await sequelize.query('SET TRANSACTION READ ONLY', { transaction })
    const rows = await sequelize.query(
      `SELECT name, setting, unit FROM pg_settings WHERE name IN ('lock_timeout', 'statement_timeout', 'application_name')`,
      { transaction, type: SELECT }
    )
    await transaction.commit()
    const by = Object.fromEntries(rows.map((r) => [r.name, r]))
    return {
      lockTimeoutMs: settingMs(by.lock_timeout),
      statementTimeoutMs: settingMs(by.statement_timeout),
      applicationName: by.application_name ? by.application_name.setting : null
    }
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {}
    throw err
  } finally {
    await sequelize.close().catch(() => {})
  }
}

// The probe child resolves its target exactly as sequelize-cli does
// (config/config.js[env]); the caller's preflight must be connection-capable,
// otherwise the probe is refused before any process is started.
function probeSessionSettings(env, childEnv, { spawn = spawnSync, preflight } = {}) {
  if (!preflight || typeof preflight.loadTargetConfig !== 'function') {
    throw new Error('guard dependency missing: preflight.loadTargetConfig — refusing to start the session probe')
  }
  const child = spawn(process.execPath, [__filename, '--env', env], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: PROBE_TIMEOUT_MS,
    env: { ...process.env, ...childEnv, NODE_ENV: env }
  })
  if (!child || child.status !== 0) {
    const detail = String((child && (child.stderr || child.error)) || '').trim().split('\n').slice(-3).join(' | ')
    throw new Error(`session probe exited ${child ? child.status : 'without status'}${detail ? `: ${detail}` : ''}`)
  }
  const line = String(child.stdout || '')
    .split('\n')
    .find((l) => l.startsWith(PROBE_MARKER))
  if (!line) throw new Error('session probe produced no result line')
  return JSON.parse(line.slice(PROBE_MARKER.length))
}

// pg_locks reports a two-key advisory lock as classid = key1, objid = key2
// (both oid, i.e. unsigned 32-bit) with objsubid = 2.
const unsigned32 = (n) => n >>> 0

// Returns { acquired: true, stillHeld, release } or { acquired: false }.
// Never waits.
async function acquireRunLock(env, { preflight, keys = D08_RUNNER_LOCK_KEYS } = {}) {
  const sequelize = connect(env, preflight)
  const SELECT = (sequelize.QueryTypes || require('sequelize').QueryTypes).SELECT
  let transaction = null
  try {
    transaction = await sequelize.transaction()
    await sequelize.query('SET TRANSACTION READ ONLY', { transaction })
    // The holder sits idle in this transaction while the migration child
    // runs; a server-side idle timeout must not end it (and the lock) early.
    await sequelize.query('SET LOCAL idle_in_transaction_session_timeout = 0', { transaction })
    const [idle] = await sequelize.query(`SELECT current_setting('idle_in_transaction_session_timeout') AS v`, { transaction, type: SELECT })
    if (!idle || idle.v !== '0') throw new Error(`idle_in_transaction_session_timeout is "${idle && idle.v}" in the holder transaction, expected "0"`)
    const [row] = await sequelize.query('SELECT pg_try_advisory_xact_lock(:k1, :k2) AS locked', {
      transaction,
      type: SELECT,
      replacements: { k1: keys[0], k2: keys[1] }
    })
    if (!row || row.locked !== true) {
      await transaction.rollback().catch(() => {})
      await sequelize.close().catch(() => {})
      return { acquired: false }
    }
  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {})
    await sequelize.close().catch(() => {})
    throw err
  }
  const held = transaction
  return {
    acquired: true,
    // Proves, on the holder transaction itself, that this backend still
    // holds exactly this key. Any error (dead session, aborted transaction)
    // is reported as not held — never assumed held.
    stillHeld: async () => {
      try {
        const [r] = await sequelize.query(
          `SELECT COUNT(*)::int AS n FROM pg_locks
            WHERE locktype = 'advisory' AND granted AND pid = pg_backend_pid()
              AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
              AND classid::bigint = :c AND objid::bigint = :o AND objsubid = 2`,
          { transaction: held, type: SELECT, replacements: { c: unsigned32(keys[0]), o: unsigned32(keys[1]) } }
        )
        return r && r.n === 1 ? { held: true } : { held: false, reason: `advisory lock not held by the holder session (count ${r && r.n})` }
      } catch (err) {
        return { held: false, reason: `holder session unusable: ${err.message}` }
      }
    },
    // Ending the transaction releases the lock. A failure here means the
    // holding session was already gone (and with it the lock) — reported,
    // never ignored; the connection is closed on every path.
    release: async () => {
      try {
        await held.rollback()
      } finally {
        await sequelize.close().catch(() => {})
      }
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  let env = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env' && argv[i + 1]) env = argv[++i]
    else {
      console.error(`[migration-session-probe] REFUSED: unknown argument "${argv[i]}"`)
      return 1
    }
  }
  try {
    const observed = await readSessionSettings(env, { preflight: require('./check-migration-preflight') })
    console.log(`${PROBE_MARKER}${JSON.stringify(observed)}`)
    return 0
  } catch (err) {
    console.error(`[migration-session-probe] FAILED: ${err.message}`)
    return 1
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code
  })
}

module.exports = { PROBE_MARKER, readSessionSettings, probeSessionSettings, acquireRunLock, main }
