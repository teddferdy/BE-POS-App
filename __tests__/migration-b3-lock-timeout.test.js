process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// D-08 B3 execution guards against a REAL PostgreSQL server — a disposable
// database only (W-02R.4 STAGING_DB_* namespace, local host, rehearsal name
// pattern; created and dropped here). Never production, never POSTGRES_*.
//
// Real: the runner's B3 path, the run lock, the read-only session probe
// child, sequelize-cli, the M3 migration file, the pg driver's PGOPTIONS /
// PGAPPNAME handling and PostgreSQL's lock_timeout. Injected: only the
// disposition-manifest preflight (this database carries no manifest) — its
// ledger snapshot is still read from the database itself.
const fs = require('fs')
const childProcess = jest.requireActual('child_process')

const harness = require('../scripts/rehearse-staging')
const preflight = require('../scripts/check-migration-preflight')
const batches = require('../scripts/migration-batches')
const { discoverMigrationFiles } = require('../scripts/check-production-schema')

const DB = `cashier_app_staging_rehearsal_b3lock_${process.pid}`
const FILES = discoverMigrationFiles()
const M3 = batches.M3_MIGRATION
const [K1, K2] = batches.D08_RUNNER_LOCK_KEYS
const LOCK_MS = batches.BATCH_SESSION_GUARDS.B3.lockTimeoutMs
const STATEMENT_MS = batches.BATCH_SESSION_GUARDS.B3.statementTimeoutMs

// The real runner, with child stdio captured instead of inherited (args and
// environment are untouched — that layering is asserted in the pure suite).
let runner
const children = []
jest.isolateModules(() => {
  jest.doMock('child_process', () => ({
    ...childProcess,
    spawnSync: (cmd, args, opts) => {
      const r = childProcess.spawnSync(cmd, args, { ...opts, stdio: 'pipe', encoding: 'utf8' })
      children.push({ args, output: `${r.stdout || ''}${r.stderr || ''}`, status: r.status })
      return r
    }
  }))
  runner = require('../scripts/run-migrations')
})

const saved = {}
let db
let created = false

// Synchronous psql against the disposable database only (used inside the
// synchronous spawn wrapper, while the runner is blocked on the child).
function psqlSync(sql) {
  const r = childProcess.spawnSync(
    'psql',
    ['-h', process.env.STAGING_DB_HOST || '127.0.0.1', '-p', String(process.env.STAGING_DB_PORT || 5432), '-U', process.env.STAGING_DB_USER || 'postgres', '-d', DB, '-X', '-Atc', sql],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: process.env.STAGING_DB_PASSWORD || '' } }
  )
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`)
  return r.stdout.trim()
}
// Can an unrelated session take the D-08 run lock right now? (autocommit:
// taken and released within the statement)
const competingTryLock = () => psqlSync(`SELECT pg_try_advisory_xact_lock(${K1}, ${K2})`)
const holderPid = () =>
  psqlSync(
    `SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND granted AND objsubid = 2
       AND classid::bigint = ${K1 >>> 0} AND objid::bigint = ${K2 >>> 0}`
  )

// Fixture reset after a run that recorded M3 (disposable database only).
async function resetM3() {
  await db.query('ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS transaction_typepayment_canonical')
  await db.query('DELETE FROM "SequelizeMeta" WHERE name = :name', { replacements: { name: M3 } })
}
const q = (sql, opts = {}) => db.query(sql, { type: db.QueryTypes.SELECT, ...opts })

function report(entry) {
  if (process.env.B3_REHEARSAL_REPORT) fs.appendFileSync(process.env.B3_REHEARSAL_REPORT, `${JSON.stringify(entry)}\n`)
}

async function state() {
  const [c] = await q(
    `SELECT COUNT(*)::int AS n, MAX(pg_get_constraintdef(oid)) AS def, BOOL_OR(convalidated) AS validated
       FROM pg_constraint WHERE conname = 'transaction_typepayment_canonical'`
  )
  const [m] = await q(`SELECT COUNT(*)::int AS n FROM "SequelizeMeta" WHERE name = :name`, { replacements: { name: M3 } })
  const [l] = await q(`SELECT COUNT(*)::int AS n FROM "SequelizeMeta"`)
  return { constraints: c.n, def: c.def, validated: c.validated, m3Recorded: m.n, ledger: l.n }
}

// Separate session holding a lock for the duration of one runner call.
async function holding(sql, fn) {
  const holder = harness.newSequelize(harness.stagingConnection({ database: DB }))
  const t = await holder.transaction()
  try {
    await holder.query(sql, { transaction: t })
    return await fn()
  } finally {
    await t.rollback().catch(() => {})
    await holder.close().catch(() => {})
  }
}

let logSpy
let errSpy
const batchRecord = () => {
  const line = logSpy.mock.calls.flat().find((l) => typeof l === 'string' && l.startsWith('[migrate] BATCH RECORD '))
  return line ? JSON.parse(line.slice('[migrate] BATCH RECORD '.length)) : null
}

// `beforeChild` / `afterChild` run synchronously inside the spawn wrapper,
// i.e. while the runner holds (or should hold) the run lock.
async function runB3({ beforeChild, afterChild } = {}) {
  children.length = 0
  logSpy.mockClear()
  errSpy.mockClear()
  const metaNames = await preflight.readRecordedMigrations('staging')
  const spawn = jest.fn((env, opts) => {
    if (beforeChild) beforeChild()
    const r = runner.defaultSpawn(env, opts)
    if (afterChild) afterChild()
    return r
  })
  const code = await runner.main({
    argv: ['--env', 'staging', '--batch', 'B3'],
    // Real preflight module (ledger + M3 state readers); only the
    // disposition-manifest decision is replaced.
    preflight: {
      ...preflight,
      report: () => {},
      runPreflight: async ({ env }) => ({ env, ok: true, applicable: true, reasons: [], files: FILES, metaNames })
    },
    spawn
  })
  process.env.NODE_ENV = 'test'
  const migrateChild = children.find((c) => c.args.includes('db:migrate'))
  return { code, spawn, record: batchRecord(), output: migrateChild ? migrateChild.output : '' }
}

beforeAll(async () => {
  for (const k of ['STAGING_DB_DATABASE', 'PGOPTIONS', 'PGAPPNAME']) saved[k] = process.env[k]
  delete process.env.PGOPTIONS
  delete process.env.PGAPPNAME
  harness.assertRehearsalTarget({ database: DB, host: process.env.STAGING_DB_HOST || '127.0.0.1' })
  process.env.STAGING_DB_DATABASE = DB
  await harness.createDatabase(harness.stagingConnection({ database: DB }), DB)
  created = true
  db = harness.newSequelize(harness.stagingConnection({ database: DB }))
  await db.query(`CREATE TABLE "SequelizeMeta" ("name" VARCHAR(255) NOT NULL UNIQUE, PRIMARY KEY ("name"))`)
  await db.query(`CREATE TABLE "transaction" (id SERIAL PRIMARY KEY, "typePayment" VARCHAR(255) NOT NULL, amount INTEGER NOT NULL DEFAULT 0)`)
  // Two canonical rows plus one historical legacy alias (NOT VALID keeps it).
  await db.query(`INSERT INTO "transaction" ("typePayment", amount) VALUES ('CASH', 555000), ('E_WALLET', 555000), ('tunai', 1000)`)
  const ledger = FILES.filter((f) => f !== M3)
  await db.query(`INSERT INTO "SequelizeMeta" (name) VALUES ${ledger.map((_, i) => `(:n${i})`).join(', ')}`, {
    replacements: Object.fromEntries(ledger.map((n, i) => [`n${i}`, n]))
  })
  const [v] = await q('SELECT version() AS v')
  report({ kind: 'environment', server: v.v, pg: require('pg/package.json').version, sequelize: require('sequelize/package.json').version })
}, 60000)

afterAll(async () => {
  if (db) await db.close().catch(() => {})
  // L3: only drop what this file created after the identity guard passed.
  if (created) await harness.dropDatabase(harness.stagingConnection({ database: DB }), DB).catch(() => {})
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  process.env.NODE_ENV = 'test'
}, 60000)

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  logSpy.mockRestore()
  errSpy.mockRestore()
})

describe('D-08 B3 guards on a disposable PostgreSQL database', () => {
  test('lock timeout: a conflicting lock makes M3 fail within lock_timeout, exit non-zero, no ledger row, no constraint', async () => {
    const before = await state()
    const t0 = Date.now()
    const run = await holding('SELECT COUNT(*) FROM "transaction"', runB3)
    const elapsed = Date.now() - t0
    const after = await state()
    report({ kind: 'lock-timeout', code: run.code, record: run.record, wallMs: elapsed, after, message: (run.output.match(/ERROR:.*lock timeout.*/) || [null])[0] })

    expect(run.code).not.toBe(0)
    expect(run.record).toMatchObject({ outcome: 'RUNNER_FAILED', runLock: 'RELEASED', added: [] })
    expect(run.record.sessionObserved).toEqual({ lockTimeoutMs: LOCK_MS, statementTimeoutMs: STATEMENT_MS, applicationName: 'd08-b3-m3' })
    expect(run.output).toMatch(/canceling statement due to lock timeout/)
    expect(run.record.runnerMs).toBeGreaterThanOrEqual(LOCK_MS)
    expect(run.record.runnerMs).toBeLessThan(STATEMENT_MS)
    expect(after).toEqual(before)
    expect(after).toMatchObject({ constraints: 0, m3Recorded: 0 })
  }, 120000)

  test('DDL committed but ledger write failed: PARTIAL_STATE (never complete), then a rerun is REFUSED before any DDL', async () => {
    await db.query(`CREATE FUNCTION b3_fail_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated ledger write failure'; END $$`)
    await db.query(`CREATE TRIGGER b3_fail_ledger BEFORE INSERT ON "SequelizeMeta" FOR EACH ROW EXECUTE FUNCTION b3_fail_ledger()`)
    let partial
    try {
      partial = await runB3()
    } finally {
      await db.query('DROP TRIGGER b3_fail_ledger ON "SequelizeMeta"')
      await db.query('DROP FUNCTION b3_fail_ledger()')
    }
    const afterPartial = await state()
    report({ kind: 'partial-state', code: partial.code, record: partial.record, after: afterPartial })
    expect(partial.code).not.toBe(0)
    expect(partial.record).toMatchObject({ outcome: 'PARTIAL_STATE' })
    expect(afterPartial).toMatchObject({ constraints: 1, m3Recorded: 0, validated: false })

    const rerun = await runB3()
    report({ kind: 'rerun-after-partial', code: rerun.code, record: rerun.record })
    expect(rerun.code).toBe(1)
    expect(rerun.spawn).not.toHaveBeenCalled()
    expect(rerun.record).toMatchObject({ outcome: 'REFUSED', preconditions: { ok: false } })
    expect(await state()).toEqual(afterPartial)

    // Test fixture reset only (disposable database).
    await db.query('ALTER TABLE "transaction" DROP CONSTRAINT transaction_typepayment_canonical')
  }, 120000)

  test('concurrency: while another session holds the D-08 run lock, B3 is REFUSED before spawning', async () => {
    const before = await state()
    const run = await holding(`SELECT pg_advisory_xact_lock(${K1}, ${K2})`, runB3)
    report({ kind: 'concurrency', code: run.code, record: run.record })
    expect(run.code).toBe(1)
    expect(run.spawn).not.toHaveBeenCalled()
    expect(run.record).toMatchObject({ outcome: 'REFUSED', runLock: 'HELD_BY_ANOTHER_RUN' })
    expect(await state()).toEqual(before)
  }, 120000)

  test('R2: a nullable "typePayment" or a missing public.transaction is REFUSED before spawning (real catalog)', async () => {
    const before = await state()
    await db.query('ALTER TABLE "transaction" ALTER COLUMN "typePayment" DROP NOT NULL')
    let nullable
    try {
      nullable = await runB3()
    } finally {
      await db.query('ALTER TABLE "transaction" ALTER COLUMN "typePayment" SET NOT NULL')
    }
    report({ kind: 'r2-nullable', code: nullable.code, record: nullable.record })
    expect(nullable.code).toBe(1)
    expect(nullable.spawn).not.toHaveBeenCalled()
    expect(nullable.record.preconditions.failures.join(' ')).toMatch(/is not NOT NULL/)

    await db.query('ALTER TABLE "transaction" RENAME TO "transaction_renamed"')
    let missing
    try {
      missing = await runB3()
    } finally {
      await db.query('ALTER TABLE "transaction_renamed" RENAME TO "transaction"')
    }
    report({ kind: 'r2-missing-relation', code: missing.code, record: missing.record })
    expect(missing.code).toBe(1)
    expect(missing.spawn).not.toHaveBeenCalled()
    expect(missing.record.preconditions.failures.join(' ')).toMatch(/relation public\.transaction not found/)
    expect(await state()).toEqual(before)
  }, 120000)

  test('R2: a column made nullable after the DDL fails the postcondition even with the exact CHECK and the ledger row', async () => {
    let run
    try {
      run = await runB3({ afterChild: () => psqlSync('ALTER TABLE "transaction" ALTER COLUMN "typePayment" DROP NOT NULL') })
    } finally {
      await db.query('ALTER TABLE "transaction" ALTER COLUMN "typePayment" SET NOT NULL')
    }
    report({ kind: 'r2-post-nullable', code: run.code, record: run.record })
    expect(run.code).toBe(1)
    expect(run.record).toMatchObject({ outcome: 'POSTCONDITION_FAILED', added: [M3] })
    expect(run.record.postconditions.failures.join(' ')).toMatch(/is not NOT NULL/)
    await resetM3()
  }, 120000)

  test('R1: the holder survives a database-wide idle_in_transaction_session_timeout (SET LOCAL 0) and keeps the lock through the child', async () => {
    await db.query(`ALTER DATABASE "${DB}" SET idle_in_transaction_session_timeout = '1s'`)
    let during
    let run
    try {
      run = await runB3({
        beforeChild: () => {
          childProcess.spawnSync('sleep', ['2.5'])
          during = competingTryLock()
        }
      })
    } finally {
      await db.query(`ALTER DATABASE "${DB}" RESET idle_in_transaction_session_timeout`)
    }
    report({ kind: 'r1-idle-timeout-survived', code: run.code, record: run.record, competingDuringChild: during })
    expect(during).toBe('f')
    expect(run.code).toBe(0)
    expect(run.record).toMatchObject({ outcome: 'RECORDED', runLock: 'RELEASED' })
    expect(run.record.runLockChecks.every((c) => c.held)).toBe(true)
    await resetM3()
  }, 120000)

  test('R1 (review probe B): holder session lost mid-run → a competing session takes the lock → SERIALIZATION_LOST, never success', async () => {
    let competing
    let terminated
    const run = await runB3({
      beforeChild: () => {
        const pid = holderPid()
        terminated = psqlSync(`SELECT pg_terminate_backend(${Number(pid)})`)
        childProcess.spawnSync('sleep', ['0.3'])
        competing = competingTryLock()
      }
    })
    const after = await state()
    report({ kind: 'r1-serialization-lost', code: run.code, record: run.record, terminated, competingDuringChild: competing, after })
    expect(terminated).toBe('t')
    expect(competing).toBe('t')
    expect(run.code).not.toBe(0)
    expect(run.record).toMatchObject({ outcome: 'SERIALIZATION_LOST', runnerStatus: 0, observedOutcome: 'RECORDED', added: [M3] })
    expect(run.record.runLockChecks[0]).toMatchObject({ at: 'before-spawn', held: true })
    expect(run.record.runLockChecks[1]).toMatchObject({ at: 'after-child', held: false })
    expect(run.record.runLock).toMatch(/^RELEASE_FAILED/)
    // The child really ran and recorded — and it is still not reported as success.
    expect(after).toMatchObject({ constraints: 1, m3Recorded: 1 })
    await resetM3()
  }, 120000)

  test('success: RECORDED with the exact NOT VALID constraint; new non-canonical writes are refused, history is kept', async () => {
    let during
    const run = await runB3({ beforeChild: () => (during = competingTryLock()) })
    const afterRun = competingTryLock()
    const after = await state()
    report({ kind: 'success', code: run.code, record: run.record, after })
    expect(run.code).toBe(0)
    expect(run.record).toMatchObject({ outcome: 'RECORDED', added: [M3], runLock: 'RELEASED', postconditions: { ok: true } })
    expect(after).toMatchObject({ constraints: 1, m3Recorded: 1, validated: false })
    expect(batches.verifyM3CanonicalCheck(run.record.postconditions.observed).ok).toBe(true)
    // The run lock was held during the child and through verification, then released.
    expect(during).toBe('f')
    expect(run.record.runLockChecks.map((c) => [c.at, c.held])).toEqual([
      ['before-spawn', true],
      ['after-child', true],
      ['after-verification', true]
    ])
    expect(afterRun).toBe('t')

    // NOT VALID semantics (evidence for the runbook, disposable data only).
    await expect(db.query(`INSERT INTO "transaction" ("typePayment") VALUES ('cash')`)).rejects.toMatchObject({ original: { code: '23514' } })
    await db.query(`INSERT INTO "transaction" ("typePayment") VALUES ('QRIS')`)
    const [legacy] = await q(`SELECT COUNT(*)::int AS n FROM "transaction" WHERE "typePayment" = 'tunai'`)
    expect(legacy.n).toBe(1)
    // Any UPDATE of a historical non-canonical row is re-checked and refused.
    await expect(db.query(`UPDATE "transaction" SET amount = amount WHERE "typePayment" = 'tunai'`)).rejects.toMatchObject({
      original: { code: '23514' }
    })
  }, 120000)
})
