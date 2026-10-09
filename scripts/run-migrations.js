'use strict'

/**
 * W-01.1 — guarded migration runner (`npm run migrate`).
 *
 * preflight (scripts/check-migration-preflight.js, in-process, fail closed)
 *   → only on success: pinned sequelize-cli `db:migrate --env <env>`.
 *
 * The runner is never started when the preflight refuses. Only `--env` (and,
 * for D-08 E2, `--batch`) is accepted so the preflight and the runner always
 * target the same environment; every other sequelize-cli flag (--url,
 * --config, --migrations-path, --to, …) is refused because it could make the
 * runner target something the preflight did not check.
 *
 * Primary replay barrier: dispositioned migrations are recorded in
 * SequelizeMeta (D-02, Model D), which every sequelize-cli invocation honours.
 * This wrapper is the secondary barrier that refuses to run while that
 * recording is incomplete or decisions/controlled applies remain open.
 *
 * D-08 E2 Option C — bounded batches (scripts/migration-batches.js):
 *   npm run migrate -- --env production --batch B1|B2|B3
 * After the preflight passes, the named batch is evaluated against the same
 * repository files and SequelizeMeta snapshot; sequelize-cli then runs with
 * `--to <last batch member>`, which executes exactly the batch because the
 * pending list was proven to start with it. The ledger is re-read afterwards
 * and must have gained exactly the batch. In a disposition-governed
 * environment (production, staging) an unbatched run is refused while any
 * batch member is pending, so all 17 cannot run by accident.
 *
 * D-08 B1 resume (scripts/migration-batches.js BATCH_RESUMES):
 *   npm run migrate -- --env production --resume B1-D05
 * Finishes a batch whose earlier members an interrupted run already recorded.
 * Exclusive with --batch. It runs only from the exact pinned incident ledger,
 * re-reads the ledger afterwards (exact row count and members), checks the
 * resume's schema postconditions read-only, and prints one machine-readable
 * `[migrate] RESUME RECORD {...}` line for every run it starts.
 *
 * B3 execution guards (scripts/migration-batches.js BATCH_SESSION_GUARDS /
 * BATCH_STATE_CHECKS; scripts/migration-session-guard.js):
 *   - a transaction-scoped advisory run lock serializes guarded runs; the
 *     ledger is re-read under it and must still equal the preflight snapshot;
 *     the lock is proven still held (pg_locks, holder session) before the
 *     spawn, right after the child exits and after post-run verification —
 *     a lost lock is SERIALIZATION_LOST, never success;
 *   - "typePayment" must be NOT NULL, the M3 constraint absent and M3
 *     unrecorded before the run (a pre-existing same-named constraint is
 *     never adopted);
 *   - lock_timeout 3000 ms / statement_timeout 60000 ms / application_name
 *     d08-b3-m3 reach ONLY the sequelize-cli child (PGOPTIONS / PGAPPNAME),
 *     and a read-only probe must prove the target endpoint applies them
 *     before the migration starts;
 *   - afterwards the ledger AND the constraint (catalog definition,
 *     NOT VALID, exact canonical values) are inspected, and one
 *     `[migrate] BATCH RECORD {...}` line reports the outcome. Anything but
 *     RECORDED exits non-zero; nothing is retried, dropped or unrecorded.
 */

const path = require('path')
const { spawnSync } = require('child_process')
const migrationBatches = require('./migration-batches')

const ROOT = path.join(__dirname, '..')

function parseArgs(argv, batches = migrationBatches.E2_BATCHES, resumes = migrationBatches.BATCH_RESUMES) {
  let env = null
  let batch = null
  let resume = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--env' && argv[i + 1] && !argv[i + 1].startsWith('--')) env = argv[++i]
    else if (a.startsWith('--env=') && a.length > '--env='.length) env = a.slice('--env='.length)
    else if ((a === '--batch' && argv[i + 1] && !argv[i + 1].startsWith('--')) || a.startsWith('--batch=')) {
      if (batch !== null) return { error: '--batch given more than once' }
      batch = a === '--batch' ? argv[++i] : a.slice('--batch='.length)
      if (!Object.prototype.hasOwnProperty.call(batches, batch)) {
        return { error: `unknown batch "${batch}" (known: ${Object.keys(batches).join(', ')})` }
      }
    } else if ((a === '--resume' && argv[i + 1] && !argv[i + 1].startsWith('--')) || a.startsWith('--resume=')) {
      if (resume !== null) return { error: '--resume given more than once' }
      resume = a === '--resume' ? argv[++i] : a.slice('--resume='.length)
      if (!Object.prototype.hasOwnProperty.call(resumes, resume)) {
        return { error: `unknown resume "${resume}" (known: ${Object.keys(resumes).join(', ')})` }
      }
    } else return { error: `unsupported argument "${a}" (only --env, --batch and --resume are accepted)` }
  }
  if (batch !== null && resume !== null) return { error: '--batch and --resume are mutually exclusive' }
  return { env, batch, resume }
}

// `childEnv` (B3 session guard only) is layered over the operator's
// environment for the sequelize-cli process alone; NODE_ENV always wins.
function defaultSpawn(env, { to, childEnv } = {}) {
  const cli = require.resolve('sequelize-cli/lib/sequelize')
  const args = [cli, 'db:migrate', '--env', env]
  if (to) args.push('--to', to)
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...(childEnv || {}), NODE_ENV: env }
  })
}

const NO_RETRY =
  'Inspect SequelizeMeta and the schema independently (read-only) before any further action; ' +
  'a rerun needs fresh authorization. The runner never retries.'

async function runBatch({ env, batchId, result, spawn, readMeta, batches, guards }) {
  if (!result.applicable) {
    console.error(`[migrate] REFUSED: --batch applies only to disposition-governed environments (production, staging), not "${env}".`)
    return 1
  }
  const evaluation = migrationBatches.evaluateBatch({ batchId, files: result.files, metaNames: result.metaNames, batches })
  if (!evaluation.ok) {
    console.error(`[migrate] REFUSED batch ${batchId} — sequelize-cli db:migrate was NOT started:`)
    for (const r of evaluation.reasons) console.error(`  - ${r}`)
    return 1
  }
  console.log(`[migrate] batch ${batchId} (${evaluation.batch.title}): ${evaluation.migrations.length} migration(s), --to ${evaluation.to}`)
  for (const m of evaluation.migrations) console.log(`  - ${m}`)
  const sessionGuard = Object.prototype.hasOwnProperty.call(guards.sessionGuards, batchId) ? guards.sessionGuards[batchId] : null
  const stateCheck = Object.prototype.hasOwnProperty.call(guards.stateChecks, batchId) ? guards.stateChecks[batchId] : null
  if (sessionGuard || stateCheck) {
    return runGuardedBatch({ env, batchId, result, evaluation, spawn, readMeta, guards, sessionGuard, stateCheck })
  }
  const child = spawn(env, { to: evaluation.to })
  const status = child && typeof child.status === 'number' ? child.status : 1
  let after
  try {
    after = await readMeta(env)
  } catch (err) {
    console.error(
      `[migrate] LEDGER_UNVERIFIED for batch ${batchId}: SequelizeMeta could not be re-read after the runner exited ${status} (${err.message}). ${NO_RETRY}`
    )
    return status !== 0 ? status : 1
  }
  const check = migrationBatches.verifyBatchRecorded({ migrations: evaluation.migrations, before: result.metaNames, after })
  if (status !== 0) {
    console.error(`[migrate] batch ${batchId} runner exited ${status}; recorded before failure: ${check.added.join(', ') || '(none)'}`)
    return status
  }
  if (!check.ok) {
    console.error(`[migrate] POST-RUN LEDGER MISMATCH for batch ${batchId} — investigate before any further run:`)
    if (check.unexpected.length) console.error(`  - recorded outside the batch: ${check.unexpected.join(', ')}`)
    if (check.missing.length) console.error(`  - batch members not recorded: ${check.missing.join(', ')}`)
    return 1
  }
  console.log(`[migrate] batch ${batchId} recorded exactly: ${check.added.join(', ')}`)
  return 0
}

const sameNames = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every((n) => a.includes(n))

// B3 (BATCH_SESSION_GUARDS / BATCH_STATE_CHECKS): the run is serialized by
// the D-08 run lock, re-checks the ledger under that lock, requires the
// pre-run state, proves the session guard on the target endpoint, runs
// sequelize-cli bounded by it, then inspects ledger AND schema. Every
// outcome other than RECORDED exits non-zero and is printed as one
// machine-readable `[migrate] BATCH RECORD {...}` line. Outcomes:
//   REFUSED            — not started (lock held/unavailable, ledger moved,
//                        pre-state not clean, session guard unproven)
//   RECORDED           — ran, ledger gained exactly the batch, postconditions PASS
//   RUNNER_FAILED      — runner failed; ledger unchanged and constraint absent (inspected)
//   PARTIAL_STATE      — runner failed but the ledger or schema changed
//   LEDGER_UNVERIFIED  — SequelizeMeta could not be re-read afterwards
//   STATE_UNVERIFIED   — the schema state could not be read afterwards
//   LEDGER_MISMATCH    — runner succeeded but the ledger is not exactly the batch
//   POSTCONDITION_FAILED — runner succeeded but the schema postcondition fails
//   SERIALIZATION_LOST — the run lock was not provably held for the whole
//                        run (checked after the child and after verification);
//                        observed ledger/constraint state is reported, but a
//                        recorded row does not prove exclusive execution
//   UNEXPECTED_ERROR   — the guarded run threw; state unknown
async function runGuardedBatch({ env, batchId, result, evaluation, spawn, readMeta, guards, sessionGuard, stateCheck }) {
  const record = {
    batch: batchId,
    env,
    migrations: evaluation.migrations,
    to: evaluation.to,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    sessionGuard,
    runLock: null,
    sessionObserved: null,
    preconditions: null,
    runLockChecks: [],
    observedOutcome: null,
    runnerStatus: null,
    runnerSignal: null,
    runnerMs: null,
    ledgerBefore: result.metaNames.length,
    ledgerAfter: null,
    added: [],
    postconditions: null,
    outcome: null,
    exitCode: null,
    message: null
  }
  let lock
  try {
    lock = await guards.acquireRunLock(env)
  } catch (err) {
    lock = null
    record.runLock = `UNAVAILABLE: ${err.message}`
  }
  let verdict
  if (!lock || !lock.acquired) {
    record.runLock = record.runLock || 'HELD_BY_ANOTHER_RUN'
    verdict = { outcome: 'REFUSED', exitCode: 1, message: `run lock not acquired (${record.runLock}); sequelize-cli db:migrate was NOT started.` }
  } else {
    record.runLock = 'ACQUIRED'
    try {
      verdict = await guardedRun({ env, batchId, result, evaluation, spawn, readMeta, guards, sessionGuard, stateCheck, record, lock })
    } catch (err) {
      verdict = {
        outcome: 'UNEXPECTED_ERROR',
        exitCode: 1,
        message: `${err.message}; ledger and schema state unknown (runner status: ${record.runnerStatus === null ? 'not recorded' : record.runnerStatus}). ${NO_RETRY}`
      }
    } finally {
      try {
        await lock.release()
        record.runLock = 'RELEASED'
      } catch (err) {
        record.runLock = `RELEASE_FAILED: ${err.message}`
        console.error(
          `[migrate] WARNING: run lock release failed (${err.message}); the holding session ended, so the run may not have been serialized for its whole duration.`
        )
      }
    }
  }
  Object.assign(record, { outcome: verdict.outcome, exitCode: verdict.exitCode, message: verdict.message, finishedAt: new Date().toISOString() })
  if (verdict.outcome === 'RECORDED') console.log(`[migrate] ${verdict.message}`)
  else console.error(`[migrate] ${verdict.outcome} for batch ${batchId}: ${verdict.message}`)
  console.log(`[migrate] BATCH RECORD ${JSON.stringify(record)}`)
  return verdict.exitCode
}

async function guardedRun({ env, batchId, result, evaluation, spawn, readMeta, guards, sessionGuard, stateCheck, record, lock }) {
  const refuse = (message) => ({ outcome: 'REFUSED', exitCode: 1, message: `${message}; sequelize-cli db:migrate was NOT started.` })
  const checkLock = async (at) => {
    let r
    try {
      r = typeof lock.stillHeld === 'function' ? await lock.stillHeld() : { held: false, reason: 'run lock exposes no stillHeld() check' }
    } catch (err) {
      r = { held: false, reason: err.message }
    }
    const entry = { at, held: r && r.held === true, ...(r && r.reason ? { reason: r.reason } : {}) }
    record.runLockChecks.push(entry)
    return entry
  }

  // The decision was made on the preflight snapshot; refuse if the ledger
  // moved before this run held the lock.
  let current
  try {
    current = await readMeta(env)
  } catch (err) {
    return refuse(`SequelizeMeta unreadable under the run lock (${err.message})`)
  }
  if (!sameNames(current, result.metaNames)) {
    return refuse(`SequelizeMeta changed since the preflight (${result.metaNames.length} → ${current.length} rows)`)
  }

  if (stateCheck) {
    let state
    try {
      state = await guards.readBatchState(env, stateCheck.id)
    } catch (err) {
      return refuse(`pre-run state ${stateCheck.id} unreadable (${err.message})`)
    }
    const pre = stateCheck.before(state)
    record.preconditions = { id: stateCheck.id, ok: pre.ok, failures: pre.failures }
    if (!pre.ok) return refuse(`pre-run state ${stateCheck.id} not clean: ${pre.failures.join('; ')}`)
  }

  let childEnv = null
  if (sessionGuard) {
    childEnv = migrationBatches.sessionEnv(sessionGuard)
    let observed
    try {
      observed = await guards.probeSession(env, childEnv)
    } catch (err) {
      return refuse(`session guard unproven on the target endpoint (${err.message})`)
    }
    record.sessionObserved = observed
    const session = migrationBatches.verifySessionSettings(observed, sessionGuard)
    if (!session.ok) return refuse(`target endpoint did not apply the session guard: ${session.failures.join('; ')}`)
    console.log(
      `[migrate] session guard in effect on target: lock_timeout ${observed.lockTimeoutMs} ms, statement_timeout ${observed.statementTimeoutMs} ms, application_name ${observed.applicationName}`
    )
  }

  const beforeSpawn = await checkLock('before-spawn')
  if (!beforeSpawn.held) return refuse(`run lock lost before the migration started (${beforeSpawn.reason})`)

  const startedMs = Date.now()
  const child = spawn(env, childEnv ? { to: evaluation.to, childEnv } : { to: evaluation.to })
  record.runnerMs = Date.now() - startedMs
  const status = child && typeof child.status === 'number' ? child.status : 1
  record.runnerStatus = status
  record.runnerSignal = (child && child.signal) || null
  const afterChild = await checkLock('after-child')
  const verdict = await classifyRun({ env, batchId, result, evaluation, readMeta, guards, stateCheck, record, status })
  const afterVerify = await checkLock('after-verification')
  if (afterChild.held && afterVerify.held) return verdict
  const lost = afterChild.held ? afterVerify : afterChild
  record.observedOutcome = verdict.outcome
  return {
    outcome: 'SERIALIZATION_LOST',
    exitCode: verdict.exitCode !== 0 ? verdict.exitCode : 1,
    message:
      `run lock not provably held for the whole run (${lost.at}: ${lost.reason}); another guarded run could have overlapped. ` +
      `Observed, not proven exclusive — underlying classification ${verdict.outcome}: ${verdict.message}`
  }
}

// Post-run inspection and classification (ledger, then schema). Never
// retries, repairs or drops anything.
async function classifyRun({ env, batchId, result, evaluation, readMeta, guards, stateCheck, record, status }) {
  const exited = `runner exited ${status}${record.runnerSignal ? ` (signal ${record.runnerSignal})` : ''}`

  let after
  try {
    after = await readMeta(env)
  } catch (err) {
    return {
      outcome: 'LEDGER_UNVERIFIED',
      exitCode: status !== 0 ? status : 1,
      message: `SequelizeMeta could not be re-read after the ${exited} (${err.message}); whether ${evaluation.to} was recorded is unknown. ${NO_RETRY}`
    }
  }
  const check = migrationBatches.verifyBatchRecorded({ migrations: evaluation.migrations, before: result.metaNames, after })
  record.ledgerAfter = after.length
  record.added = check.added

  let state = null
  let post = null
  if (stateCheck) {
    try {
      state = await guards.readBatchState(env, stateCheck.id)
      post = stateCheck.after(state)
      record.postconditions = { id: stateCheck.id, ok: post.ok, failures: post.failures, observed: state }
    } catch (err) {
      record.postconditions = { id: stateCheck.id, ok: false, failures: [`state unavailable: ${err.message}`], observed: null }
    }
  }
  const stateUnverified = Boolean(stateCheck) && !state

  if (status !== 0) {
    if (stateUnverified) {
      return {
        outcome: 'STATE_UNVERIFIED',
        exitCode: status,
        message: `${exited}; recorded before failure: ${check.added.join(', ') || '(none)'}; schema state could not be read. ${NO_RETRY}`
      }
    }
    const constraintPresent = Boolean(state) && state.constraints.length > 0
    if (check.added.length === 0 && !constraintPresent) {
      return {
        outcome: 'RUNNER_FAILED',
        exitCode: status,
        message:
          `${exited} after ${record.runnerMs} ms; no SequelizeMeta row added; ` +
          `${stateCheck ? `${stateCheck.id} constraint absent (inspected; the rest of the schema was not inspected)` : 'schema not inspected'}. ${NO_RETRY}`
      }
    }
    const recordedTarget = check.added.includes(evaluation.to)
    const detail =
      recordedTarget && !constraintPresent
        ? 'ledger records it but the constraint is absent'
        : !recordedTarget && constraintPresent
          ? 'the DDL committed without its ledger row'
          : recordedTarget && constraintPresent
            ? 'ledger and constraint both present although the runner reported failure'
            : 'the ledger changed outside the expected member'
    return {
      outcome: 'PARTIAL_STATE',
      exitCode: status,
      message:
        `${exited} but state changed — rows added: ${check.added.join(', ') || '(none)'}; ` +
        `constraint present: ${constraintPresent} (${detail}). Do NOT rerun. ${NO_RETRY}`
    }
  }
  if (!check.ok) {
    const detail = [
      check.unexpected.length ? `recorded outside the batch: ${check.unexpected.join(', ')}` : null,
      check.missing.length ? `batch members not recorded: ${check.missing.join(', ')}` : null
    ]
      .filter(Boolean)
      .join('; ')
    return { outcome: 'LEDGER_MISMATCH', exitCode: 1, message: `POST-RUN LEDGER MISMATCH — ${detail}. ${NO_RETRY}` }
  }
  if (stateUnverified) {
    return { outcome: 'STATE_UNVERIFIED', exitCode: 1, message: `ledger recorded the batch but the schema state could not be read. ${NO_RETRY}` }
  }
  if (post && !post.ok) {
    return {
      outcome: 'POSTCONDITION_FAILED',
      exitCode: 1,
      message: `POST-RUN POSTCONDITION FAILURE (${stateCheck.id}): ${post.failures.join('; ')}. Nothing is dropped or unrecorded automatically. ${NO_RETRY}`
    }
  }
  return {
    outcome: 'RECORDED',
    exitCode: 0,
    message: `batch ${batchId} recorded exactly: ${check.added.join(', ')} (SequelizeMeta ${record.ledgerBefore} → ${after.length})${stateCheck ? `; postconditions ${stateCheck.id} PASS` : ''}`
  }
}

// Each batch state check id maps to exactly one read-only reader.
async function defaultReadBatchState(preflight, env, id) {
  if (id === 'M3_CANONICAL_CHECK') return preflight.readM3CanonicalCheckState(env)
  throw new Error(`no read-only reader for batch state check "${id}"`)
}

// Schema evidence for the RESUME RECORD: the observed target definitions
// verbatim (schema only; no member data).
function observedEvidence(id, state) {
  if (id !== 'D05_MEMBER_IDENTITY' || !state || !state.indexDefs) return null
  const indexDefs = {}
  for (const name of migrationBatches.D05_TARGET_INDEX_NAMES) {
    if (Object.prototype.hasOwnProperty.call(state.indexDefs, name)) indexDefs[name] = state.indexDefs[name]
  }
  return { indexDefs, constraintNames: state.constraintNames, nonCanonicalActivePhones: state.nonCanonicalActivePhones }
}

// Each resume postcondition id maps to exactly one read-only reader.
async function defaultReadPostconditionState(preflight, env, id) {
  if (id === 'D05_MEMBER_IDENTITY') return preflight.readMemberIdentityObjects(env)
  throw new Error(`no read-only reader for postcondition "${id}"`)
}

async function runResume({ env, resumeId, result, spawn, readMeta, readPostconditionState, batches, resumes }) {
  if (!result.applicable) {
    console.error(`[migrate] REFUSED: --resume applies only to disposition-governed environments (production, staging), not "${env}".`)
    return 1
  }
  const evaluation = migrationBatches.evaluateResume({ resumeId, files: result.files, metaNames: result.metaNames, batches, resumes })
  if (!evaluation.ok) {
    console.error(`[migrate] REFUSED resume ${resumeId} — sequelize-cli db:migrate was NOT started:`)
    for (const r of evaluation.reasons) console.error(`  - ${r}`)
    return 1
  }
  const { resume } = evaluation
  console.log(`[migrate] resume ${resumeId} (${resume.title}): ${evaluation.migrations.length} migration(s), --to ${evaluation.to}`)
  for (const m of evaluation.migrations) console.log(`  - ${m}`)
  const record = {
    resume: resumeId,
    batch: resume.batch,
    env,
    migrations: evaluation.migrations,
    to: evaluation.to,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    runnerStatus: null,
    ledgerBefore: result.metaNames.length,
    ledgerAfter: null,
    added: [],
    postconditions: null,
    outcome: null,
    exitCode: null
  }
  const finish = (outcome, exitCode) => {
    Object.assign(record, { outcome, exitCode, finishedAt: new Date().toISOString() })
    console.log(`[migrate] RESUME RECORD ${JSON.stringify(record)}`)
    return exitCode
  }
  const child = spawn(env, { to: evaluation.to })
  record.runnerStatus = child && typeof child.status === 'number' ? child.status : 1
  let after
  try {
    after = await readMeta(env)
  } catch (err) {
    console.error(
      `[migrate] LEDGER UNVERIFIED for resume ${resumeId}: SequelizeMeta could not be re-read after the runner exited ${record.runnerStatus} (${err.message}). ` +
        'Whether D-05 was recorded is unknown — verify SequelizeMeta read-only before any further run.'
    )
    return finish('LEDGER_UNVERIFIED', record.runnerStatus !== 0 ? record.runnerStatus : 1)
  }
  const check = migrationBatches.verifyBatchRecorded({ migrations: evaluation.migrations, before: result.metaNames, after })
  record.ledgerAfter = after.length
  record.added = check.added
  if (record.runnerStatus !== 0) {
    console.error(`[migrate] resume ${resumeId} runner exited ${record.runnerStatus}; recorded before failure: ${check.added.join(', ') || '(none)'}`)
    return finish('RUNNER_FAILED', record.runnerStatus)
  }
  if (!check.ok || after.length !== evaluation.ledgerAfter) {
    console.error(`[migrate] POST-RUN LEDGER MISMATCH for resume ${resumeId} — investigate before any further run:`)
    if (after.length !== evaluation.ledgerAfter) console.error(`  - SequelizeMeta has ${after.length} row(s), expected ${evaluation.ledgerAfter}`)
    if (check.unexpected.length) console.error(`  - recorded outside the resume: ${check.unexpected.join(', ')}`)
    if (check.missing.length) console.error(`  - resume members not recorded: ${check.missing.join(', ')}`)
    return finish('LEDGER_MISMATCH', 1)
  }
  const verify = migrationBatches.POSTCONDITIONS[resume.postconditions]
  let post
  let observed = null
  try {
    const state = await readPostconditionState(env, resume.postconditions)
    post = verify(state)
    observed = observedEvidence(resume.postconditions, state)
  } catch (err) {
    post = { ok: false, failures: [`postcondition state unavailable: ${err.message}`] }
  }
  record.postconditions = { id: resume.postconditions, ok: post.ok, failures: post.failures, observed }
  if (!post.ok) {
    console.error(`[migrate] POST-RUN POSTCONDITION FAILURE for resume ${resumeId} (${resume.postconditions}) — investigate before any further run:`)
    for (const f of post.failures) console.error(`  - ${f}`)
    return finish('POSTCONDITION_FAILED', 1)
  }
  console.log(`[migrate] resume ${resumeId} recorded exactly: ${check.added.join(', ')} (SequelizeMeta ${record.ledgerBefore} → ${after.length}); postconditions ${resume.postconditions} PASS`)
  return finish('RECORDED', 0)
}

async function main({
  argv = process.argv.slice(2),
  preflight = require('./check-migration-preflight'),
  // The real sequelize-cli child targets config/config.js[env]; it is only
  // started for a connection-capable (real) preflight, never behind a stub.
  spawn = (env, opts) => {
    if (typeof preflight.loadTargetConfig !== 'function') {
      throw new Error('guard dependency missing: preflight.loadTargetConfig — refusing to start sequelize-cli behind a stubbed preflight')
    }
    return defaultSpawn(env, opts)
  },
  readMeta = (env) => preflight.readRecordedMigrations(env),
  readPostconditionState = (env, id) => defaultReadPostconditionState(preflight, env, id),
  batches = migrationBatches.E2_BATCHES,
  resumes = migrationBatches.BATCH_RESUMES,
  sessionGuards = migrationBatches.BATCH_SESSION_GUARDS,
  stateChecks = migrationBatches.BATCH_STATE_CHECKS,
  // Guard defaults resolve connections ONLY through the injected preflight;
  // a preflight without loadTargetConfig fails closed (REFUSED, no spawn).
  acquireRunLock = (env) => require('./migration-session-guard').acquireRunLock(env, { preflight }),
  probeSession = (env, childEnv) => require('./migration-session-guard').probeSessionSettings(env, childEnv, { preflight }),
  readBatchState = (env, id) => defaultReadBatchState(preflight, env, id)
} = {}) {
  const parsed = parseArgs(argv, batches, resumes)
  if (parsed.error) {
    console.error(`[migrate] REFUSED: ${parsed.error}`)
    return 1
  }
  const env = preflight.resolveEnv(parsed.env)
  const result = await preflight.runPreflight({ env })
  preflight.report(result)
  if (!result.ok) {
    console.error('[migrate] sequelize-cli db:migrate was NOT started.')
    return 1
  }
  if (parsed.batch) {
    const guards = { sessionGuards, stateChecks, acquireRunLock, probeSession, readBatchState }
    return runBatch({ env, batchId: parsed.batch, result, spawn, readMeta, batches, guards })
  }
  if (parsed.resume) {
    return runResume({ env, resumeId: parsed.resume, result, spawn, readMeta, readPostconditionState, batches, resumes })
  }
  if (result.applicable) {
    if (!Array.isArray(result.files) || !Array.isArray(result.metaNames)) {
      console.error('[migrate] REFUSED: SequelizeMeta state unavailable for the D-08 batch guard; sequelize-cli db:migrate was NOT started.')
      return 1
    }
    const pending = migrationBatches.pendingBatchMembers({ files: result.files, metaNames: result.metaNames, batches })
    if (pending.length) {
      const ids = [...new Set(pending.map((p) => p.batch))]
      console.error(
        `[migrate] REFUSED: ${pending.length} pending D-08 E2 batch migration(s) requires --batch (${ids.join(', ')}); sequelize-cli db:migrate was NOT started.`
      )
      return 1
    }
  }
  const child = spawn(env)
  return child && typeof child.status === 'number' ? child.status : 1
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code
  })
}

module.exports = { parseArgs, main, defaultReadPostconditionState, defaultReadBatchState, defaultSpawn }
