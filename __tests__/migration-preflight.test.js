process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// W-01.1 — migration runner preflight + guarded runner.
// Pure: the preflight decision is evaluated from supplied state, and the
// runner wrapper is exercised with an injected preflight and spawn, so no
// database is touched and sequelize-cli is never started by these tests.
const preflight = require('../scripts/check-migration-preflight')
const runner = require('../scripts/run-migrations')
const rules = require('../scripts/migration-dispositions')
const { discoverMigrationFiles } = require('../scripts/check-production-schema')

const FILES = discoverMigrationFiles()

function approvedRepositoryManifest(transform = (r) => r) {
  const { manifest } = rules.readDispositionManifest()
  return {
    ...manifest,
    approvedBy: 'reviewer@example.test',
    approvedAt: '2026-10-02T00:00:00Z',
    migrations: manifest.migrations.map(transform)
  }
}
const resolveAll = (r) => {
  if (r.disposition === 'CONTROLLED_APPLY_PENDING') return { ...r, disposition: 'CONTROLLED_APPLIED', applyRef: 'simulated' }
  if (r.disposition === 'BLOCKED_DECISION') return { ...r, disposition: 'EXCLUDED_BY_DECISION' }
  return r
}
const allDispositionsStamped = (manifest) => manifest.migrations.map((r) => r.migration).sort()

describe('W-01.1 migration preflight (production)', () => {
  const evaluate = (state) => preflight.evaluatePreflight({ env: 'production', targetHost: 'db.example.test', files: FILES, ...state })

  test('valid state (approved, all dispositions stamped, nothing blocked/pending) allows the runner', () => {
    const dispositions = approvedRepositoryManifest(resolveAll)
    // E2 migrations not yet recorded — those are exactly what the runner should run.
    const result = evaluate({ dispositions, metaNames: allDispositionsStamped(dispositions) })
    expect(result.reasons).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.applicable).toBe(true)
  })

  test('BLOCKED_DECISION remaining → refused', () => {
    const dispositions = approvedRepositoryManifest((r) => (r.disposition === 'CONTROLLED_APPLY_PENDING' ? resolveAll(r) : r))
    const result = evaluate({ dispositions, metaNames: allDispositionsStamped(dispositions) })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/BLOCKED_DECISION remains \(5\)/)
  })

  test('CONTROLLED_APPLY_PENDING remaining → refused', () => {
    const dispositions = approvedRepositoryManifest((r) => (r.disposition === 'BLOCKED_DECISION' ? resolveAll(r) : r))
    const result = evaluate({ dispositions, metaNames: allDispositionsStamped(dispositions) })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/CONTROLLED_APPLY_PENDING remains \(3\)/)
  })

  test('disposition missing from SequelizeMeta (E4/E5 would replay) → refused', () => {
    const dispositions = approvedRepositoryManifest(resolveAll)
    const unsafe = '20260610000000-remove-invoice-footer-logo-social.js'
    const metaNames = allDispositionsStamped(dispositions).filter((n) => n !== unsafe)
    const result = evaluate({ dispositions, metaNames })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/not stamped in SequelizeMeta[\s\S]*20260610000000/)
  })

  test('the W-02 production ledger as captured (26 rows, nothing stamped) → refused', () => {
    const metaNames = FILES.filter((f) => f < '20260601000000' || /^20261008|^20261009|^20261010/.test(f))
    expect(metaNames).toHaveLength(26)
    const { manifest } = rules.readDispositionManifest()
    const result = evaluate({ dispositions: manifest, metaNames })
    expect(result.ok).toBe(false)
    const joined = result.reasons.join('\n')
    expect(joined).toMatch(/not approved/)
    expect(joined).toMatch(/not stamped in SequelizeMeta[^\n]*\(197\)/)
  })

  test('manifest/repository mismatch → refused', () => {
    const dispositions = approvedRepositoryManifest()
    dispositions.migrations = [...dispositions.migrations, { migration: '29991231000000-ghost.js', disposition: 'ATTESTED_PRESENT', evidenceRef: 'e' }]
    const result = evaluate({ dispositions, metaNames: [...FILES] })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/unknown migration/)
  })

  test('orphan SequelizeMeta row → refused', () => {
    const dispositions = approvedRepositoryManifest(resolveAll)
    const result = evaluate({ dispositions, metaNames: [...allDispositionsStamped(dispositions), '29991231000000-ghost.js'] })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/rows with no migration file/)
  })

  test('unreadable/malformed manifest → refused (fail closed)', () => {
    const result = evaluate({ dispositions: null, dispositionErrors: ['disposition manifest is malformed JSON: x'], metaNames: [] })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/malformed JSON/)
  })

  test('unreadable SequelizeMeta → refused', () => {
    const result = evaluate({ dispositions: approvedRepositoryManifest(resolveAll), metaNames: null })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/SequelizeMeta unreadable/)
  })
})

describe('W-01.1 migration preflight (non-production environments)', () => {
  test('local development target is allowed (no production manifest applies)', () => {
    const result = preflight.evaluatePreflight({ env: 'development', targetHost: '127.0.0.1', files: FILES })
    expect(result).toEqual({ ok: true, applicable: false, reasons: [], blocked: [] })
  })

  test('blocked isolation is opt-in and off by default (production behavior unchanged)', () => {
    const dispositions = { ...require('../scripts/migration-dispositions').readDispositionManifest().manifest }
    const approved = { ...dispositions, approvedBy: 't', approvedAt: '2026-10-02T00:00:00Z' }
    const metaNames = approved.migrations.map((r) => r.migration)
    const strict = preflight.evaluatePreflight({ env: 'production', targetHost: 'db', dispositions: approved, files: FILES, metaNames })
    expect(strict.ok).toBe(false)
    expect(strict.reasons.join('\n')).toMatch(/BLOCKED_DECISION remains \(5\)/)
    expect(strict.blocked).toHaveLength(5)
    const isolated = preflight.evaluatePreflight({
      env: 'production',
      targetHost: 'db',
      dispositions: approved,
      files: FILES,
      metaNames,
      isolateBlockedDecisions: true
    })
    // Controlled-pending rows still fail the gate; only BLOCKED is isolated.
    expect(isolated.reasons.join('\n')).toMatch(/CONTROLLED_APPLY_PENDING remains \(3\)/)
    expect(isolated.reasons.join('\n')).not.toMatch(/BLOCKED_DECISION remains/)
    expect(isolated.blocked).toHaveLength(5)
  })
  test('non-production environment pointing at a non-local host → refused', () => {
    const result = preflight.evaluatePreflight({ env: 'development', targetHost: 'ep-prod.example.neon.tech', files: FILES })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toMatch(/non-local host/)
  })
  test('env resolution mirrors sequelize-cli (--env, else NODE_ENV, else development)', () => {
    expect(preflight.resolveEnv('production')).toBe('production')
    const saved = process.env.NODE_ENV
    try {
      delete process.env.NODE_ENV
      expect(preflight.resolveEnv()).toBe('development')
      process.env.NODE_ENV = 'test'
      expect(preflight.resolveEnv()).toBe('test')
    } finally {
      process.env.NODE_ENV = saved
    }
  })
})

describe('W-01.1 guarded runner (npm run migrate)', () => {
  const fakePreflight = (result) => ({
    resolveEnv: preflight.resolveEnv,
    report: () => {},
    runPreflight: jest.fn(async ({ env }) => ({ env, ...result }))
  })
  let errSpy
  beforeEach(() => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errSpy.mockRestore())

  test('preflight refusal → runner is NEVER spawned, exit 1', async () => {
    const spawn = jest.fn()
    const pf = fakePreflight({ ok: false, applicable: true, reasons: ['BLOCKED_DECISION remains'] })
    const code = await runner.main({ argv: ['--env', 'production'], preflight: pf, spawn })
    expect(code).toBe(1)
    expect(pf.runPreflight).toHaveBeenCalledWith({ env: 'production' })
    expect(spawn).not.toHaveBeenCalled()
  })

  test('preflight success → runner spawned once for the SAME env, after preflight', async () => {
    const order = []
    const pf = fakePreflight({ ok: true, applicable: true, reasons: [] })
    pf.runPreflight.mockImplementation(async ({ env }) => {
      order.push('preflight')
      return { env, ok: true, applicable: true, reasons: [] }
    })
    const spawn = jest.fn((env) => {
      order.push(`spawn:${env}`)
      return { status: 0 }
    })
    const code = await runner.main({ argv: ['--env=production'], preflight: pf, spawn })
    expect(code).toBe(0)
    expect(order).toEqual(['preflight', 'spawn:production'])
  })

  test('runner exit status is propagated', async () => {
    const pf = fakePreflight({ ok: true, applicable: false, reasons: [] })
    const code = await runner.main({ argv: [], preflight: pf, spawn: () => ({ status: 3 }) })
    expect(code).toBe(3)
  })

  test('flags that could retarget the runner are refused before preflight', async () => {
    for (const argv of [['--url', 'postgres://x'], ['--config', 'x.js'], ['--migrations-path', 'x'], ['--to', 'x.js'], ['--env']]) {
      const spawn = jest.fn()
      const pf = fakePreflight({ ok: true, applicable: false, reasons: [] })
      const code = await runner.main({ argv, preflight: pf, spawn })
      expect(code).toBe(1)
      expect(pf.runPreflight).not.toHaveBeenCalled()
      expect(spawn).not.toHaveBeenCalled()
    }
  })

  test('npm run migrate goes through the guarded runner with the pinned sequelize-cli', () => {
    const pkg = require('../package.json')
    expect(pkg.scripts.migrate).toBe('node scripts/run-migrations.js')
    expect(pkg.devDependencies['sequelize-cli']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(require('sequelize-cli/package.json').version).toBe(pkg.devDependencies['sequelize-cli'])
    expect(Object.values(pkg.scripts).join('\n')).not.toMatch(/npx sequelize-cli/)
  })
})
