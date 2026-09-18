/**
 * Runs the Jest suite as a series of separate node processes ("shards")
 * instead of one long-lived process. A ~50-150MB-per-file memory leak
 * somewhere in shared test/app setup (not yet root-caused) means running
 * all 149 files in a single process reliably OOMs before the suite
 * finishes. Each shard is a fresh OS process, so memory is fully reset
 * between shards regardless of the leak's source. --runInBand is kept
 * within each shard because every test file shares one Postgres test DB.
 */
const { spawnSync } = require('child_process')

const FILES_PER_SHARD = parseInt(process.env.TEST_FILES_PER_SHARD || '8', 10)

const list = spawnSync(
  process.execPath,
  ['--experimental-vm-modules', 'node_modules/.bin/jest', '--listTests', ...process.argv.slice(2)],
  { encoding: 'utf8' }
)
if (list.status !== 0) {
  process.stderr.write(list.stderr)
  process.exit(list.status || 1)
}
const files = list.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
const totalShards = Math.max(1, Math.ceil(files.length / FILES_PER_SHARD))

console.log(`[run-tests-sharded] ${files.length} test files across ${totalShards} shard(s) of ~${FILES_PER_SHARD} files each`)

let failed = false
for (let i = 1; i <= totalShards; i++) {
  console.log(`\n[run-tests-sharded] === shard ${i}/${totalShards} ===`)
  const res = spawnSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      'node_modules/.bin/jest',
      '--runInBand',
      '--forceExit',
      '--detectOpenHandles',
      `--shard=${i}/${totalShards}`,
      ...process.argv.slice(2)
    ],
    { stdio: 'inherit' }
  )
  if (res.status !== 0) failed = true
}

process.exit(failed ? 1 : 0)
