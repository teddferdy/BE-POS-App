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

function defaultSpawn(env, { to } = {}) {
  const cli = require.resolve('sequelize-cli/lib/sequelize')
  const args = [cli, 'db:migrate', '--env', env]
  if (to) args.push('--to', to)
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: env }
  })
}

async function runBatch({ env, batchId, result, spawn, readMeta, batches }) {
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
  const child = spawn(env, { to: evaluation.to })
  const status = child && typeof child.status === 'number' ? child.status : 1
  const after = await readMeta(env)
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
  spawn = defaultSpawn,
  readMeta = (env) => preflight.readRecordedMigrations(env),
  readPostconditionState = (env, id) => defaultReadPostconditionState(preflight, env, id),
  batches = migrationBatches.E2_BATCHES,
  resumes = migrationBatches.BATCH_RESUMES
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
  if (parsed.batch) return runBatch({ env, batchId: parsed.batch, result, spawn, readMeta, batches })
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

module.exports = { parseArgs, main, defaultReadPostconditionState }
