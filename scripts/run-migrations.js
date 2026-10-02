'use strict'

/**
 * W-01.1 — guarded migration runner (`npm run migrate`).
 *
 * preflight (scripts/check-migration-preflight.js, in-process, fail closed)
 *   → only on success: pinned sequelize-cli `db:migrate --env <env>`.
 *
 * The runner is never started when the preflight refuses. Only `--env` is
 * accepted so the preflight and the runner always target the same
 * environment; every other sequelize-cli flag (--url, --config,
 * --migrations-path, --to, …) is refused because it could make the runner
 * target something the preflight did not check.
 *
 * Primary replay barrier: dispositioned migrations are recorded in
 * SequelizeMeta (D-02, Model D), which every sequelize-cli invocation honours.
 * This wrapper is the secondary barrier that refuses to run while that
 * recording is incomplete or decisions/controlled applies remain open.
 */

const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')

function parseArgs(argv) {
  let env = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--env' && argv[i + 1] && !argv[i + 1].startsWith('--')) env = argv[++i]
    else if (a.startsWith('--env=') && a.length > '--env='.length) env = a.slice('--env='.length)
    else return { error: `unsupported argument "${a}" (only --env is accepted)` }
  }
  return { env }
}

function defaultSpawn(env) {
  const cli = require.resolve('sequelize-cli/lib/sequelize')
  return spawnSync(process.execPath, [cli, 'db:migrate', '--env', env], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: env }
  })
}

async function main({
  argv = process.argv.slice(2),
  preflight = require('./check-migration-preflight'),
  spawn = defaultSpawn
} = {}) {
  const parsed = parseArgs(argv)
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
  const child = spawn(env)
  return child && typeof child.status === 'number' ? child.status : 1
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code
  })
}

module.exports = { parseArgs, main }
