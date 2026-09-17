'use strict'

/**
 * Phase 30F-1 — static guard against accidental destructive Sequelize sync.
 *
 * Flags `sequelize.sync({ force: true })` / `sync({ alter: true })` patterns
 * in runtime code. Deterministic grep-based check, no AST, no DB.
 *
 * Usage:
 *   node scripts/check-no-force-sync.js [--scan-dir=<dir>]
 *
 * Default scan roots (relative to repo root): api, db/models, scripts, utils.
 * Skipped: node_modules, __tests__, db/migrations, db/seeders, .git,
 *   and this checker file itself.
 *
 * Allowed exception:
 *   scripts/migrate.js may contain sync({ force: true }) ONLY when guarded —
 *   it must reference destructive-guard, ALLOW_DESTRUCTIVE_SYNC and --force.
 *   Without all three markers the file is flagged.
 */

const fs = require('fs')
const path = require('path')

const DANGEROUS_RE = /\.sync\s*\(\s*\{\s*(force|alter)\s*:\s*true/
const GUARD_MARKERS = [
  'destructive-guard',
  'ALLOW_DESTRUCTIVE_SYNC',
  '--force'
]

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '__tests__',
  '.git',
  '.wwebjs_auth',
  '.wwebjs_auth_default'
])
const SKIP_PATH_FRAGMENTS = ['db/migrations', 'db/seeders']

function listJsFiles(dir, out = []) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name)) continue
      const rel = path.relative(process.cwd(), full).split(path.sep).join('/')
      if (SKIP_PATH_FRAGMENTS.some((f) => rel.includes(f))) continue
      listJsFiles(full, out)
    } else if (e.isFile() && e.name.endsWith('.js')) {
      if (path.basename(full) === path.basename(__filename)) continue
      out.push(full)
    }
  }
  return out
}

function checkFiles(files) {
  const hits = []
  for (const file of files) {
    let content = ''
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = content.split('\n')
    lines.forEach((line, idx) => {
      if (DANGEROUS_RE.test(line)) {
        hits.push({ file, line: idx + 1, text: line.trim().slice(0, 160) })
      }
    })
    // Guarded exception: migrate.js must carry all guard markers.
    if (path.basename(file) === 'migrate.js' && hits.some((h) => h.file === file)) {
      const hasAllMarkers = GUARD_MARKERS.every((m) => content.includes(m))
      if (hasAllMarkers) {
        for (let i = hits.length - 1; i >= 0; i--) {
          if (hits[i].file === file) hits.splice(i, 1)
        }
      }
    }
  }
  return hits
}

function main() {
  const scanArg = process.argv.find((a) => a.startsWith('--scan-dir='))
  let files
  if (scanArg) {
    files = listJsFiles(scanArg.slice('--scan-dir='.length))
  } else {
    const root = process.cwd()
    files = []
    for (const sub of ['api', 'db/models', 'scripts', 'utils']) {
      listJsFiles(path.join(root, sub), files)
    }
  }
  const hits = checkFiles(files)
  if (hits.length > 0) {
    console.error('[force-sync-check] DANGEROUS sync pattern detected:')
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}: ${h.text}`)
    }
    process.exit(1)
  }
  console.log('[force-sync-check] OK: no unguarded sync({ force:true / alter:true }) found.')
}

if (require.main === module) {
  main()
}

module.exports = { DANGEROUS_RE, GUARD_MARKERS, checkFiles, listJsFiles }
