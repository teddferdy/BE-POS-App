process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// D-08 — production controlled-apply contract tests.
//
// Pure gate tests run without a database. Anything touching tables runs
// against a dedicated disposable database (created + dropped by this suite —
// never shared tables, never the test DB's real objects, never production or
// staging infrastructure, never production credentials).
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { Sequelize } = require('sequelize')

const rules = require('../scripts/migration-dispositions')
const ctl = require('../scripts/controlled-apply-production')

const REGION_MIGRATION = '20260812010000-create-region-table.js'
const REVIEW_MIGRATION = '20260829000001-create-product-review-table.js'
const SPLIT_MIGRATION = '20260906000004-split-bill-hardening.js'
const ARBITRARY_MIGRATION = '20260601000001-change-product-store-to-jsonb.js'

const DB_HOST = '127.0.0.1'
const DB_PORT = '5432'
const DB_USER = 'postgres'
const DISPOSABLE_DB = `cashier_app_ctlapply_${process.pid}`

// ---------- fixtures ----------

function fixtureManifest(dir, migration, disposition = 'CONTROLLED_APPLY_PENDING', approved = true) {
  const manifest = {
    schemaVersion: 1,
    environment: 'production',
    evidenceCapturedAt: '2026-10-05T18:29:17.353Z',
    approvedBy: approved ? 'fixture-approver' : null,
    approvedAt: approved ? '2026-10-05T19:00:00.000Z' : null,
    migrations: [{ migration, disposition, evidenceRef: 'test fixture' }]
  }
  const manifestPath = path.join(dir, `manifest-${crypto.randomBytes(4).toString('hex')}.json`)
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return { manifest, manifestPath, sha: rules.sha256OfFile(manifestPath) }
}

function fixtureBackup(dir, dbName, sha, overrides = {}) {
  const doc = {
    databaseIdentity: dbName,
    environment: 'production',
    backupTimestamp: new Date().toISOString(),
    mechanism: 'pg_dump custom-format full-database',
    scope: 'full database (all schemas)',
    completionStatus: 'success',
    backupRef: 'db_backup#1 backup_fixture.dump',
    retention: 'local artifact, retained 7d',
    restoreCapability: 'UNTESTED: pg_restore custom-format, no restore drill performed',
    releaseManifestSha: sha,
    operator: 'fixture-operator',
    ...overrides
  }
  const p = path.join(dir, `backup-${crypto.randomBytes(4).toString('hex')}.json`)
  fs.writeFileSync(p, JSON.stringify(doc))
  return p
}

function baseArgs(extra = '') {
  return [
    '--target=production',
    `--migration=${SPLIT_MIGRATION}`,
    '--authorization-ref=CHG-2026-001',
    '--operator=tester',
    '--backup-evidence=/tmp/does-not-matter.json',
    ...(extra ? [extra] : [])
  ]
}

// ---------- pure gate tests (no database) ----------

describe('controlled-apply Gate 1 (environment) + arg parsing', () => {
  test('1. correct target accepted', () => {
    const opts = ctl.parseArgs(baseArgs())
    expect(opts.target).toBe('production')
    expect(opts.apply).toBe(false)
  })

  for (const target of ['staging', 'development', 'local', 'rehearsal', 'PRODUCTION', '']) {
    test(`2. wrong environment rejected: ${target === '' ? '(empty)' : target}`, () => {
      expect(() => ctl.parseArgs(baseArgs().map((a) => (a.startsWith('--target=') ? `--target=${target}` : a))))
        .toThrow(/not production|is required/)
    })
  }

  test('16a. missing target refused', () => {
    expect(() => ctl.parseArgs(baseArgs().filter((a) => !a.startsWith('--target=')))).toThrow(/--target/)
  })

  test('16b. unknown flags refused (fail closed)', () => {
    expect(() => ctl.parseArgs([...baseArgs(), '--yes'])).toThrow(/unknown argument/)
    expect(() => ctl.parseArgs([...baseArgs(), '--force'])).toThrow(/unknown argument/)
  })
})

describe('controlled-apply Gate 5 (allowlist)', () => {
  for (const m of [REGION_MIGRATION, REVIEW_MIGRATION, SPLIT_MIGRATION]) {
    test(`allowlisted migration accepted: ${m}`, () => {
      const opts = ctl.parseArgs(baseArgs().map((a) => (a.startsWith('--migration=') ? `--migration=${m}` : a)))
      expect(opts.migration).toBe(m)
    })
  }

  test('7. arbitrary migration rejected even with full flags', () => {
    expect(() => ctl.parseArgs(baseArgs().map((a) => (a.startsWith('--migration=') ? `--migration=${ARBITRARY_MIGRATION}` : a))))
      .toThrow(/not on the controlled-apply allowlist/)
  })
})

describe('controlled-apply Gate 8 (authorization) + Gate 9 (confirmation)', () => {
  test('9a. missing authorization refused', () => {
    expect(() => ctl.parseArgs(baseArgs().filter((a) => !a.startsWith('--authorization-ref=')))).toThrow(/authorization-ref/)
  })

  test('9b. malformed authorization refused', () => {
    expect(() => ctl.parseArgs(baseArgs().map((a) => (a.startsWith('--authorization-ref=') ? '--authorization-ref=x' : a))))
      .toThrow(/authorization-ref/)
  })

  test('9c. missing operator refused', () => {
    expect(() => ctl.parseArgs(baseArgs().filter((a) => !a.startsWith('--operator=')))).toThrow(/operator/)
  })

  test('10a. --apply without --confirm refused', () => {
    expect(() => ctl.parseArgs([...baseArgs(), '--apply', '--authorize-manifest-sha256=' + '0'.repeat(64)]))
      .toThrow(/--confirm/)
  })

  test('10b. wrong --confirm value refused', () => {
    expect(() => ctl.parseArgs([...baseArgs(), '--apply', '--authorize-manifest-sha256=' + '0'.repeat(64), `--confirm=${REGION_MIGRATION}`]))
      .toThrow(/typed confirmation/)
  })

  test('10c. --confirm without --apply refused', () => {
    expect(() => ctl.parseArgs([...baseArgs(), `--confirm=${SPLIT_MIGRATION}`])).toThrow(/only meaningful with --apply/)
  })

  test('10d. --apply without sha refused', () => {
    expect(() => ctl.parseArgs([...baseArgs(), '--apply', `--confirm=${SPLIT_MIGRATION}`])).toThrow(/authorize-manifest-sha256/)
  })
})

describe('CAP-001 production manifest binding (no CLI override)', () => {
  test('CAP-001-T1. --manifest CLI flag rejected', () => {
    expect(() => ctl.parseArgs([...baseArgs(), '--manifest=/tmp/custom.json']))
      .toThrow(/unknown argument/)
  })

  test('CAP-001-T2. production main() resolves the canonical manifest path', () => {
    // No CLI argument influences the path: the resolver takes no input and
    // returns the repository's canonical production-manifest constant.
    expect(ctl.resolveProductionManifestPath()).toBe(rules.PRODUCTION_DISPOSITIONS_PATH)
    expect(ctl.resolveProductionManifestPath()).toMatch(/db\/migration-dispositions\/production\.json$/)
    // The parsed CLI surface exposes no manifest path at all.
    expect('manifestPath' in ctl.parseArgs(baseArgs())).toBe(false)
  })

  test('CAP-001-T3. manifest injection vectors rejected', () => {
    for (const flag of [
      '--manifest=/tmp/x.json',
      '--manifest=',
      '--manifest=../../production.json',
      '--MANIFEST=/tmp/x.json',
      '--manifest =/tmp/x.json'
    ]) {
      expect(() => ctl.parseArgs([...baseArgs(), flag])).toThrow(/unknown argument/)
    }
    // Below the CLI boundary, runControlledApply() still accepts an explicit
    // manifestPath for unit tests (every live test in this file exercises
    // that injection point against the disposable database — never via CLI).
    expect(typeof ctl.runControlledApply).toBe('function')
  })

  test('CAP-001-T4. manifest SHA authorization behavior unchanged', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-cap001-'))
    try {
      const { manifest, manifestPath, sha } = fixtureManifest(dir, SPLIT_MIGRATION)
      // Correct SHA + approved + pending passes Gates 3/4.
      const ok = ctl.verifyManifestRow({
        manifest, manifestPath, files: [SPLIT_MIGRATION], environment: 'production',
        migration: SPLIT_MIGRATION, authorizeSha256: sha, apply: true
      })
      expect(ok.validation.ok).toBe(true)
      expect(ok.validation.approved).toBe(true)
      // Wrong SHA still refused.
      expect(() => ctl.verifyManifestRow({
        manifest, manifestPath, files: [SPLIT_MIGRATION], environment: 'production',
        migration: SPLIT_MIGRATION, authorizeSha256: 'f'.repeat(64), apply: true
      })).toThrow(/does not match the authorized sha256/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('CAP-001-T5. approved/pending gates unchanged', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-cap001-'))
    try {
      // Unapproved manifest passes dry-run validation (approval binds --apply only).
      const unapproved = fixtureManifest(dir, SPLIT_MIGRATION, 'CONTROLLED_APPLY_PENDING', false)
      const dry = ctl.verifyManifestRow({
        manifest: unapproved.manifest, manifestPath: unapproved.manifestPath,
        files: [SPLIT_MIGRATION], environment: 'production',
        migration: SPLIT_MIGRATION, authorizeSha256: null, apply: false
      })
      expect(dry.validation.ok).toBe(true)
      expect(dry.validation.approved).toBe(false)
      // Non-pending row still refused in dry-run.
      const attested = fixtureManifest(dir, SPLIT_MIGRATION, 'ATTESTED_PRESENT')
      expect(() => ctl.verifyManifestRow({
        manifest: attested.manifest, manifestPath: attested.manifestPath,
        files: [SPLIT_MIGRATION], environment: 'production',
        migration: SPLIT_MIGRATION, authorizeSha256: null, apply: false
      })).toThrow(/not CONTROLLED_APPLY_PENDING/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('controlled-apply Gate 4 (ledger state) + Gate 3 (manifest)', () => {
  let dir
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-manifest-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  test('6a. non-PENDING (attested) migration rejected', () => {
    const { manifest, manifestPath } = fixtureManifest(dir, SPLIT_MIGRATION, 'ATTESTED_PRESENT')
    expect(() => ctl.verifyManifestRow({
      manifest, manifestPath, files: [SPLIT_MIGRATION], environment: 'production',
      migration: SPLIT_MIGRATION, authorizeSha256: null, apply: false
    })).toThrow(/not CONTROLLED_APPLY_PENDING/)
  })

  test('6b. already-applied migration rejected (no double apply)', () => {
    const { manifest, manifestPath } = fixtureManifest(dir, SPLIT_MIGRATION, 'CONTROLLED_APPLIED')
    manifest.migrations[0].applyRef = 'controlled-apply/x'
    expect(() => ctl.verifyManifestRow({
      manifest, manifestPath, files: [SPLIT_MIGRATION], environment: 'production',
      migration: SPLIT_MIGRATION, authorizeSha256: null, apply: false
    })).toThrow(/not CONTROLLED_APPLY_PENDING/)
  })

  test('6c. migration with no manifest row rejected', () => {
    const { manifest, manifestPath } = fixtureManifest(dir, REGION_MIGRATION)
    expect(() => ctl.verifyManifestRow({
      manifest, manifestPath, files: [REGION_MIGRATION], environment: 'production',
      migration: SPLIT_MIGRATION, authorizeSha256: null, apply: false
    })).toThrow(/no manifest row/)
  })

  test('4. wrong manifest SHA rejected on --apply', () => {
    const { manifest, manifestPath } = fixtureManifest(dir, SPLIT_MIGRATION)
    expect(() => ctl.verifyManifestRow({
      manifest, manifestPath, files: [SPLIT_MIGRATION], environment: 'production',
      migration: SPLIT_MIGRATION, authorizeSha256: '0'.repeat(64), apply: true
    })).toThrow(/does not match the authorized sha256/)
  })

  test('5. unapproved manifest rejected on --apply', () => {
    const { manifest, manifestPath, sha } = fixtureManifest(dir, SPLIT_MIGRATION, 'CONTROLLED_APPLY_PENDING', false)
    expect(() => ctl.verifyManifestRow({
      manifest, manifestPath, files: [SPLIT_MIGRATION], environment: 'production',
      migration: SPLIT_MIGRATION, authorizeSha256: sha, apply: true
    })).toThrow(/not approved/)
  })
})

describe('controlled-apply Gate 7 (backup evidence contract)', () => {
  let dir
  let sha
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-backup-'))
    sha = 'a'.repeat(64)
  })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })
  const verify = (p, db = 'targetdb') =>
    ctl.verifyBackupEvidence({ evidencePath: p, expectedDatabase: db, manifestSha: sha })

  test('8a. missing file rejected', () => {
    expect(() => verify(path.join(dir, 'nope.json'))).toThrow(/unreadable/)
  })

  test('8b. malformed JSON rejected', () => {
    const p = path.join(dir, 'bad.json')
    fs.writeFileSync(p, '{oops')
    expect(() => verify(p)).toThrow(/not valid JSON/)
  })

  for (const field of ['completionStatus', 'backupRef', 'retention', 'restoreCapability', 'operator', 'mechanism', 'scope']) {
    test(`8c. missing field rejected: ${field}`, () => {
      const doc = JSON.parse(fs.readFileSync(fixtureBackup(dir, 'targetdb', sha)))
      delete doc[field]
      const p = path.join(dir, 'missing.json')
      fs.writeFileSync(p, JSON.stringify(doc))
      expect(() => verify(p)).toThrow(new RegExp(field))
    })
  }

  test('8d. non-production environment rejected', () => {
    expect(() => verify(fixtureBackup(dir, 'targetdb', sha, { environment: 'staging' }))).toThrow(/not production/)
  })

  test('3-adjacent. wrong database identity rejected', () => {
    expect(() => verify(fixtureBackup(dir, 'otherdb', sha))).toThrow(/does not match target database/)
  })

  test('8e. stale (>72h) evidence rejected', () => {
    const old = new Date(Date.now() - 73 * 3600 * 1000).toISOString()
    expect(() => verify(fixtureBackup(dir, 'targetdb', sha, { backupTimestamp: old }))).toThrow(/older than 72h/)
  })

  test('8f. future timestamp rejected', () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString()
    expect(() => verify(fixtureBackup(dir, 'targetdb', sha, { backupTimestamp: future }))).toThrow(/in the future/)
  })

  test('8g. non-success completion rejected', () => {
    expect(() => verify(fixtureBackup(dir, 'targetdb', sha, { completionStatus: 'failed' }))).toThrow(/not success/)
  })

  test('8h. release SHA mismatch rejected', () => {
    expect(() => verify(fixtureBackup(dir, 'targetdb', sha, { releaseManifestSha: 'b'.repeat(64) }))).toThrow(/not bound to this release/)
  })

  test('valid evidence accepted', () => {
    const doc = verify(fixtureBackup(dir, 'targetdb', sha))
    expect(doc.backupRef).toBe('db_backup#1 backup_fixture.dump')
  })
})

// ---------- database tests (disposable database) ----------

describe('CAP-002 assertIndexShape (exact catalog shape, no substrings)', () => {
  const expected = { schema: 'public', table: 'region', name: 'region_code_unique', unique: true, columns: ['code'] }
  const shape = (overrides = {}) => ({
    schema: 'public', table: 'region', name: 'region_code_unique',
    unique: true, columns: ['code'], nullAttrs: 0, ...overrides
  })

  test('exact shape passes', () => {
    expect(() => ctl.assertIndexShape(shape(), expected)).not.toThrow()
  })

  test('wrong column fails (postalCode substring trap)', () => {
    expect(() => ctl.assertIndexShape(shape({ columns: ['postalCode'] }), expected))
      .toThrow(/shape mismatch/)
  })

  test('extra column fails', () => {
    expect(() => ctl.assertIndexShape(shape({ columns: ['code', 'postalCode'] }), expected))
      .toThrow(/shape mismatch/)
  })

  test('missing column fails', () => {
    expect(() => ctl.assertIndexShape(shape({ columns: [] }), expected))
      .toThrow(/shape mismatch/)
  })

  test('column order matters', () => {
    expect(() => ctl.assertIndexShape(
      shape({ columns: ['postalCode', 'code'] }),
      { ...expected, columns: ['code', 'postalCode'] }
    )).toThrow(/shape mismatch/)
  })

  test('non-unique fails a unique expectation', () => {
    expect(() => ctl.assertIndexShape(shape({ unique: false }), expected))
      .toThrow(/unique=/)
  })

  test('wrong table/schema/name fails', () => {
    expect(() => ctl.assertIndexShape(shape({ table: 'other' }), expected)).toThrow(/shape mismatch/)
    expect(() => ctl.assertIndexShape(shape({ schema: 'other' }), expected)).toThrow(/shape mismatch/)
    expect(() => ctl.assertIndexShape(shape({ name: 'region_code_typo' }), expected)).toThrow(/shape mismatch/)
  })

  test('expression entries fail closed', () => {
    expect(() => ctl.assertIndexShape(shape({ nullAttrs: 1 }), expected)).toThrow(/expression/)
  })

  test('missing index fails closed', () => {
    expect(() => ctl.assertIndexShape(null, expected)).toThrow(/missing after apply/)
  })
})

describe('controlled-apply live gates (disposable database)', () => {
  let sequelize
  let dir

  const q = (sql, replacements) => sequelize.query(sql, { replacements, type: Sequelize.QueryTypes.SELECT })

  beforeAll(async () => {
    const createdb = spawnSync('createdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, DISPOSABLE_DB], { encoding: 'utf8' })
    if (createdb.status !== 0) throw new Error(`createdb failed: ${createdb.stderr}`)
    sequelize = new Sequelize({
      dialect: 'postgres', host: DB_HOST, port: DB_PORT,
      username: DB_USER, database: DISPOSABLE_DB, logging: false
    })
    await sequelize.query('CREATE TABLE region ("id" SERIAL PRIMARY KEY, "code" VARCHAR(20) NOT NULL, "level" VARCHAR(10) NOT NULL, "parentCode" VARCHAR(20), "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW())')
    await sequelize.query('CREATE TABLE product_review ("id" SERIAL PRIMARY KEY, "productId" INTEGER NOT NULL, "store" INTEGER, "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())')
    await sequelize.query('CREATE TABLE "order" ("id" SERIAL PRIMARY KEY)')
    await sequelize.query('CREATE TABLE split_bill ("id" SERIAL PRIMARY KEY, "order" INTEGER, "status" VARCHAR(20), "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())')
    await sequelize.query('CREATE TABLE "SequelizeMeta" ("name" VARCHAR(255) PRIMARY KEY)')
    await sequelize.query("INSERT INTO region (code, level) VALUES ('ID-JK', 'province'), ('ID-JK-01', 'city')")
    await sequelize.query("INSERT INTO split_bill (\"order\", status) VALUES (NULL, 'pending')")
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-live-'))
  }, 60000)

  afterAll(async () => {
    if (sequelize) await sequelize.close().catch(() => {})
    spawnSync('dropdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, DISPOSABLE_DB])
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  function liveOpts(migration, applyRef = {}) {
    const { manifest, manifestPath, sha } = fixtureManifest(dir, migration)
    return {
      sequelize,
      expectedDatabase: DISPOSABLE_DB,
      manifestPath,
      manifest,
      files: [migration],
      environment: 'production',
      migration,
      authorizationRef: 'CHG-2026-001',
      backupEvidencePath: fixtureBackup(dir, DISPOSABLE_DB, sha),
      manifestSha: sha,
      operator: 'tester',
      ...applyRef
    }
  }

  test('3. database crossover rejected (identity mismatch)', async () => {
    await expect(ctl.verifyTargetDatabase(sequelize, 'some_other_db')).rejects.toThrow(/does not match configured target/)
  })

  test('live identity accepted for the correct database', async () => {
    await expect(ctl.verifyTargetDatabase(sequelize, DISPOSABLE_DB)).resolves.toBe(DISPOSABLE_DB)
  })

  test('11. failed precondition refuses with no writes (NULL split_bill)', async () => {
    await sequelize.query("INSERT INTO split_bill (\"order\", status) VALUES (NULL, NULL)")
    const opts = liveOpts(SPLIT_MIGRATION)
    const manifestBefore = fs.readFileSync(opts.manifestPath, 'utf8')
    await expect(ctl.runControlledApply(opts)).rejects.toThrow(/precondition failed/)
    // 14. ledger untouched after refusal.
    expect(fs.readFileSync(opts.manifestPath, 'utf8')).toBe(manifestBefore)
    const idx = await q("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='split_bill_order_idempotencykey'")
    expect(idx).toEqual([])
    await sequelize.query('DELETE FROM split_bill WHERE status IS NULL')
  })

  test('11b. failed precondition refuses with no writes (duplicate region code)', async () => {
    await sequelize.query("INSERT INTO region (code, level) VALUES ('ID-JK', 'province')")
    const opts = liveOpts(REGION_MIGRATION)
    await expect(ctl.runControlledApply(opts)).rejects.toThrow(/region\.code-unique/)
    const idx = await q("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='region_code_unique'")
    expect(idx).toEqual([])
    await sequelize.query("DELETE FROM region WHERE id NOT IN (SELECT MIN(id) FROM region GROUP BY code)")
  })

  test('16c. dry-run writes nothing', async () => {
    const opts = liveOpts(REVIEW_MIGRATION)
    const manifestBefore = fs.readFileSync(opts.manifestPath, 'utf8')
    const evidence = await ctl.runControlledApply(opts)
    expect(evidence.mode).toBe('dry-run')
    expect(evidence.status).toBe('ok')
    expect(evidence.preconditions.length).toBeGreaterThan(0)
    expect(fs.readFileSync(opts.manifestPath, 'utf8')).toBe(manifestBefore)
    const idx = await q("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('product_review_product_store', 'product_review_store')")
    expect(idx).toEqual([])
  })

  test('12+13+14. successful apply: postcondition verified, ledger flips only on success', async () => {
    const opts = liveOpts(REVIEW_MIGRATION, { apply: true, confirm: REVIEW_MIGRATION })
    const evidence = await ctl.runControlledApply(opts)
    expect(evidence.mode).toBe('apply')
    expect(evidence.applied).toEqual(['product_review_product_store', 'product_review_store'])
    expect(evidence.postcondition).toBe('verified-in-transaction')
    expect(evidence.dispositionAfter).toBe('CONTROLLED_APPLIED')
    expect(evidence.applyRef).toMatch(/^controlled-apply\//)
    // Postcondition independently re-read: both present and NON-unique.
    const idx = await q("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('product_review_product_store', 'product_review_store')")
    expect(idx.map((r) => r.indexname).sort()).toEqual(['product_review_product_store', 'product_review_store'])
    for (const row of idx) expect(row.indexdef.toUpperCase().split(' ON ')[0]).not.toMatch(/\bUNIQUE\b/)
    // Ledger flipped with applyRef, still valid.
    const saved = JSON.parse(fs.readFileSync(opts.manifestPath, 'utf8'))
    expect(saved.migrations[0].disposition).toBe('CONTROLLED_APPLIED')
    expect(typeof saved.migrations[0].applyRef).toBe('string')
    expect(rules.validateDispositionManifest(saved, { files: [REVIEW_MIGRATION], environment: 'production' }).ok).toBe(true)
  })

  test('13b. postcondition catches wrong-definition index (fail closed)', async () => {
    // Pre-create the unique index name with a WRONG (non-unique) definition:
    // CREATE IF NOT EXISTS skips, postcondition must detect the mismatch.
    await sequelize.query('CREATE INDEX "region_code_unique" ON "region" ("code")')
    const opts = liveOpts(REGION_MIGRATION, { apply: true, confirm: REGION_MIGRATION })
    await expect(ctl.runControlledApply(opts)).rejects.toThrow(/postcondition failed/)
    const saved = JSON.parse(fs.readFileSync(opts.manifestPath, 'utf8'))
    expect(saved.migrations[0].disposition).toBe('CONTROLLED_APPLY_PENDING')
    await sequelize.query('DROP INDEX "region_code_unique"')
  })

  test('15. retry semantics: no double-apply; fixed preconditions succeed', async () => {
    // (a) An APPLIED row refuses a second apply (Gate 4) — double execution impossible.
    const opts = liveOpts(SPLIT_MIGRATION, { apply: true, confirm: SPLIT_MIGRATION })
    const first = await ctl.runControlledApply(opts)
    expect(first.dispositionAfter).toBe('CONTROLLED_APPLIED')
    const reloaded = JSON.parse(fs.readFileSync(opts.manifestPath, 'utf8'))
    await expect(ctl.runControlledApply({ ...opts, manifest: reloaded })).rejects.toThrow(/not CONTROLLED_APPLY_PENDING/)
    // (b) Fresh PENDING manifest retries cleanly (idempotent re-invocation).
    const retry = liveOpts(SPLIT_MIGRATION, { apply: true, confirm: SPLIT_MIGRATION })
    const second = await ctl.runControlledApply(retry)
    expect(second.status).toBe('ok')
    const nullable = await q("SELECT is_nullable FROM information_schema.columns WHERE table_name='split_bill' AND column_name='status'")
    expect(nullable[0].is_nullable).toBe('NO')
  })

  // CAP-002 adversarial regression: the disposable region table has no
  // postalCode column, so tests add it (test-local DDL, dropped afterwards).
  async function ensurePostalCode() {
    await sequelize.query('ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "postalCode" VARCHAR(10)')
  }
  async function dropRegionCodeUnique() {
    await sequelize.query('DROP INDEX IF EXISTS "region_code_unique"')
  }
  async function dedupeRegion() {
    await sequelize.query('DELETE FROM region WHERE id NOT IN (SELECT MIN(id) FROM region GROUP BY code)')
  }

  test('CAP-002-T1. same-name wrong-column UNIQUE index refused (postalCode trap)', async () => {
    await dedupeRegion()
    await ensurePostalCode()
    await dropRegionCodeUnique()
    await sequelize.query('CREATE UNIQUE INDEX "region_code_unique" ON "region" ("postalCode")')
    try {
      const opts = liveOpts(REGION_MIGRATION, { apply: true, confirm: REGION_MIGRATION })
      const manifestBefore = fs.readFileSync(opts.manifestPath, 'utf8')
      // 'POSTALCODE'.includes('CODE') is true — the old substring check
      // passed this shape; the catalog check must refuse it.
      await expect(ctl.runControlledApply(opts)).rejects.toThrow(/shape mismatch/)
      expect(fs.readFileSync(opts.manifestPath, 'utf8')).toBe(manifestBefore)
      expect(JSON.parse(fs.readFileSync(opts.manifestPath, 'utf8')).migrations[0].disposition)
        .toBe('CONTROLLED_APPLY_PENDING')
    } finally {
      await sequelize.query('DROP INDEX "region_code_unique"')
    }
  })

  test('CAP-002-T2. correct UNIQUE (code) passes', async () => {
    await dedupeRegion()
    await dropRegionCodeUnique()
    await sequelize.query('CREATE UNIQUE INDEX "region_code_unique" ON "region" ("code")')
    try {
      const opts = liveOpts(REGION_MIGRATION, { apply: true, confirm: REGION_MIGRATION })
      const evidence = await ctl.runControlledApply(opts)
      expect(evidence.status).toBe('ok')
      expect(evidence.dispositionAfter).toBe('CONTROLLED_APPLIED')
      const shape = await ctl.indexShape(sequelize, 'region_code_unique')
      expect(shape).toMatchObject({ schema: 'public', table: 'region', unique: true, columns: ['code'] })
    } finally {
      await sequelize.query('DROP INDEX "region_code_unique"')
    }
  })

  test('CAP-002-T3. same-name non-unique index fails closed', async () => {
    await dedupeRegion()
    await dropRegionCodeUnique()
    await sequelize.query('CREATE INDEX "region_code_unique" ON "region" ("code")')
    try {
      const opts = liveOpts(REGION_MIGRATION, { apply: true, confirm: REGION_MIGRATION })
      await expect(ctl.runControlledApply(opts)).rejects.toThrow(/unique=/)
      expect(JSON.parse(fs.readFileSync(opts.manifestPath, 'utf8')).migrations[0].disposition)
        .toBe('CONTROLLED_APPLY_PENDING')
    } finally {
      await sequelize.query('DROP INDEX "region_code_unique"')
    }
  })

  test('CAP-002-T4. correct columns plus extra column fails closed', async () => {
    await dedupeRegion()
    await ensurePostalCode()
    await dropRegionCodeUnique()
    await sequelize.query('CREATE UNIQUE INDEX "region_code_unique" ON "region" ("code", "postalCode")')
    try {
      const opts = liveOpts(REGION_MIGRATION, { apply: true, confirm: REGION_MIGRATION })
      await expect(ctl.runControlledApply(opts)).rejects.toThrow(/columns/)
      expect(JSON.parse(fs.readFileSync(opts.manifestPath, 'utf8')).migrations[0].disposition)
        .toBe('CONTROLLED_APPLY_PENDING')
    } finally {
      await sequelize.query('DROP INDEX "region_code_unique"')
    }
  })

  test('CAP-002-T5. wrong index name cannot satisfy the expectation', async () => {
    await dropRegionCodeUnique()
    await sequelize.query('CREATE UNIQUE INDEX "region_code_typo" ON "region" ("code")')
    try {
      const found = await ctl.indexShape(sequelize, 'region_code_typo')
      expect(found.name).toBe('region_code_typo')
      expect(() => ctl.assertIndexShape(found, {
        schema: 'public', table: 'region', name: 'region_code_unique', unique: true, columns: ['code']
      })).toThrow(/shape mismatch/)
      expect(await ctl.indexShape(sequelize, 'region_code_unique')).toBeNull()
    } finally {
      await sequelize.query('DROP INDEX "region_code_typo"')
    }
  })

  test('CAP-002-T6. missing effect still applies (table+code, no dupes, index absent)', async () => {
    await dedupeRegion()
    await dropRegionCodeUnique()
    const opts = liveOpts(REGION_MIGRATION)
    const evidence = await ctl.runControlledApply(opts)
    expect(evidence.mode).toBe('dry-run')
    expect(evidence.status).toBe('ok')
    expect(evidence.preconditions.every((c) => c.passed)).toBe(true)
  })
})

// ---------- CAP-003 concurrency tests (disposable database) ----------
//
// Deterministic by construction: PostgreSQL advisory-lock serialization
// decides the winner; barrier/rendezvous hooks (never sleeps) control the
// exact interleaving for stale-state tests. Uses its own disposable
// database so it neither depends on nor disturbs the suite above.

describe('CAP-003 concurrency (disposable database)', () => {
  const DISPOSABLE_DB2 = `cashier_app_cap003_${process.pid}`
  let sequelize2
  let dir

  const q2 = (sql, replacements) => sequelize2.query(sql, { replacements, type: Sequelize.QueryTypes.SELECT })

  function cap003Manifest(migrations) {
    const manifest = {
      schemaVersion: 1,
      environment: 'production',
      evidenceCapturedAt: '2026-10-05T18:29:17.353Z',
      approvedBy: 'cap003-approver',
      approvedAt: '2026-10-05T19:00:00.000Z',
      migrations: [...migrations].sort().map((m) => ({
        migration: m,
        disposition: 'CONTROLLED_APPLY_PENDING',
        evidenceRef: 'cap003 fixture'
      }))
    }
    const manifestPath = path.join(dir, `cap003-manifest-${crypto.randomBytes(4).toString('hex')}.json`)
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    return { manifest, manifestPath, sha: rules.sha256OfFile(manifestPath) }
  }

  // One contender = one process snapshot: shared FILE, but a private
  // in-memory manifest copy (exactly like two operators starting together).
  function cap003Opts(fix, migration, operator, extra = {}) {
    return {
      sequelize: sequelize2,
      expectedDatabase: DISPOSABLE_DB2,
      manifestPath: fix.manifestPath,
      manifest: JSON.parse(JSON.stringify(fix.manifest)),
      files: fix.manifest.migrations.map((r) => r.migration),
      environment: 'production',
      migration,
      authorizationRef: 'CHG-2026-003',
      backupEvidencePath: fixtureBackup(dir, DISPOSABLE_DB2, fix.sha),
      manifestSha: fix.sha,
      operator,
      apply: true,
      confirm: migration,
      ...extra
    }
  }

  function writeManifest(manifestPath, manifest) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  beforeAll(async () => {
    const createdb = spawnSync('createdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, DISPOSABLE_DB2], { encoding: 'utf8' })
    if (createdb.status !== 0) throw new Error(`createdb failed: ${createdb.stderr}`)
    sequelize2 = new Sequelize({
      dialect: 'postgres', host: DB_HOST, port: DB_PORT,
      username: DB_USER, database: DISPOSABLE_DB2, logging: false
    })
    await sequelize2.query('CREATE TABLE region ("id" SERIAL PRIMARY KEY, "code" VARCHAR(20) NOT NULL, "level" VARCHAR(10) NOT NULL, "parentCode" VARCHAR(20), "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW())')
    await sequelize2.query('CREATE TABLE product_review ("id" SERIAL PRIMARY KEY, "productId" INTEGER NOT NULL, "store" INTEGER, "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())')
    await sequelize2.query('CREATE TABLE "order" ("id" SERIAL PRIMARY KEY)')
    await sequelize2.query('CREATE TABLE split_bill ("id" SERIAL PRIMARY KEY, "order" INTEGER, "status" VARCHAR(20), "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())')
    await sequelize2.query('CREATE TABLE "SequelizeMeta" ("name" VARCHAR(255) PRIMARY KEY)')
    await sequelize2.query("INSERT INTO region (code, level) VALUES ('ID-JK', 'province'), ('ID-JK-01', 'city')")
    await sequelize2.query("INSERT INTO split_bill (\"order\", status) VALUES (NULL, 'pending')")
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-cap003-'))
  }, 60000)

  afterAll(async () => {
    if (sequelize2) await sequelize2.close().catch(() => {})
    spawnSync('dropdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, DISPOSABLE_DB2])
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  test('CAP-003-T0. advisory lock timeout refuses without mutation', async () => {
    // A foreign session holds the controlled-apply lock for the whole test,
    // so the contender MUST hit its bounded wait and refuse deterministically.
    const [k1, k2] = ctl.advisoryLockKeys()
    const holder = await sequelize2.connectionManager.getConnection()
    try {
      await sequelize2.query('SELECT pg_advisory_lock(:k1, :k2)', {
        replacements: { k1, k2 },
        type: Sequelize.QueryTypes.SELECT,
        transaction: { connection: holder }
      })
      const fix = cap003Manifest([REVIEW_MIGRATION])
      const manifestBefore = fs.readFileSync(fix.manifestPath, 'utf8')
      await expect(ctl.runControlledApply(cap003Opts(fix, REVIEW_MIGRATION, 'cap003-t0', { _lockTimeoutMs: 800 })))
        .rejects.toThrow(/advisory lock/)
      expect(fs.readFileSync(fix.manifestPath, 'utf8')).toBe(manifestBefore)
      expect(await q2("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('product_review_product_store', 'product_review_store')")).toEqual([])
    } finally {
      await sequelize2.query('SELECT pg_advisory_unlock(:k1, :k2)', {
        replacements: { k1, k2 },
        type: Sequelize.QueryTypes.SELECT,
        transaction: { connection: holder }
      })
      sequelize2.connectionManager.releaseConnection(holder)
    }
  })

  test('CAP-003-T1. same migration concurrently: exactly one succeeds, loser refuses', async () => {
    const fix = cap003Manifest([REVIEW_MIGRATION])
    const [sA, sB] = await Promise.allSettled([
      ctl.runControlledApply(cap003Opts(fix, REVIEW_MIGRATION, 'cap003-A')),
      ctl.runControlledApply(cap003Opts(fix, REVIEW_MIGRATION, 'cap003-B'))
    ])
    const oks = [sA, sB].filter((s) => s.status === 'fulfilled')
    const bad = [sA, sB].filter((s) => s.status === 'rejected')
    expect(oks).toHaveLength(1)
    expect(bad).toHaveLength(1)
    expect(bad[0].reason.name).toBe('RefusedError')
    // Either concurrency layer may fire first (post-lock SHA re-check or
    // CAS row check); both are fail-closed refusals, never a transition.
    expect(bad[0].reason.message).toMatch(/manifest changed since authorization|not CONTROLLED_APPLY_PENDING|advisory lock/)
    const winner = oks[0].value
    expect(winner.dispositionAfter).toBe('CONTROLLED_APPLIED')
    // Only one APPLIED transition exists and the loser did not overwrite it.
    const saved = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(saved.migrations[0].disposition).toBe('CONTROLLED_APPLIED')
    expect(saved.migrations[0].applyRef).toBe(winner.applyRef)
    expect(rules.validateDispositionManifest(saved, { files: [REVIEW_MIGRATION], environment: 'production' }).ok).toBe(true)
    // Database effect is correct (both lookup indexes present, non-unique).
    for (const [name, cols] of [['product_review_product_store', ['productId', 'store']], ['product_review_store', ['store']]]) {
      ctl.assertIndexShape(await ctl.indexShape(sequelize2, name), {
        schema: 'public', table: 'product_review', name, unique: false, columns: cols
      })
    }
  })

  test('CAP-003-T2. different migrations concurrently: no lost update, retry converges', async () => {
    await sequelize2.query('DELETE FROM region WHERE id NOT IN (SELECT MIN(id) FROM region GROUP BY code)')
    await sequelize2.query('DROP INDEX IF EXISTS "region_code_unique"')
    await sequelize2.query('DROP INDEX IF EXISTS "region_level_idx"')
    await sequelize2.query('DROP INDEX IF EXISTS "region_parent_code_idx"')
    const fix = cap003Manifest([REGION_MIGRATION, SPLIT_MIGRATION])
    // Round 1: both start from SHA-A. The advisory lock serializes them; the
    // winner transitions its row (SHA-A -> SHA-B) while the loser MUST refuse
    // (its authorization base moved) WITHOUT writing anything stale.
    const contenders = [
      { migration: REGION_MIGRATION, operator: 'cap003-X' },
      { migration: SPLIT_MIGRATION, operator: 'cap003-Y' }
    ]
    const round1 = await Promise.allSettled(contenders.map((c) =>
      ctl.runControlledApply(cap003Opts(fix, c.migration, c.operator))
    ))
    const round1ok = round1.filter((s) => s.status === 'fulfilled')
    const round1bad = round1.filter((s) => s.status === 'rejected')
    expect(round1ok).toHaveLength(1)
    expect(round1bad).toHaveLength(1)
    expect(round1bad[0].reason.name).toBe('RefusedError')
    const winnerMigration = [REGION_MIGRATION, SPLIT_MIGRATION][round1.findIndex((s) => s.status === 'fulfilled')]
    const loserMigration = winnerMigration === REGION_MIGRATION ? SPLIT_MIGRATION : REGION_MIGRATION
    // No stale overwrite: the file holds exactly the winner's transition and
    // the loser's row is still PENDING (this is what the old code violated).
    const mid = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(mid.migrations.find((r) => r.migration === winnerMigration).disposition).toBe('CONTROLLED_APPLIED')
    expect(mid.migrations.find((r) => r.migration === winnerMigration).applyRef).toBe(round1ok[0].value.applyRef)
    expect(mid.migrations.find((r) => r.migration === loserMigration).disposition).toBe('CONTROLLED_APPLY_PENDING')
    expect(mid.migrations.find((r) => r.migration === loserMigration).applyRef).toBeUndefined()
    // Round 2 (spec §23 retry): the refuser re-invokes against the LATEST
    // state with fresh authorization. Final state: BOTH APPLIED, none lost.
    const latest = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    const latestSha = rules.sha256OfFile(fix.manifestPath)
    const loserOperator = loserMigration === REGION_MIGRATION ? 'cap003-X' : 'cap003-Y'
    const retry = await ctl.runControlledApply({
      ...cap003Opts(fix, loserMigration, loserOperator),
      manifest: latest,
      manifestSha: latestSha,
      backupEvidencePath: fixtureBackup(dir, DISPOSABLE_DB2, latestSha)
    })
    expect(retry.status).toBe('ok')
    const saved = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(saved.migrations.map((r) => r.disposition)).toEqual(['CONTROLLED_APPLIED', 'CONTROLLED_APPLIED'])
    expect(saved.migrations.find((r) => r.migration === winnerMigration).applyRef).toBe(round1ok[0].value.applyRef)
    expect(saved.migrations.find((r) => r.migration === loserMigration).applyRef).toBe(retry.applyRef)
    expect(rules.validateDispositionManifest(
      saved, { files: [REGION_MIGRATION, SPLIT_MIGRATION], environment: 'production' }
    ).ok).toBe(true)
    // Both database effects are correct: region indexes exact-shape …
    ctl.assertIndexShape(await ctl.indexShape(sequelize2, 'region_code_unique'), {
      schema: 'public', table: 'region', name: 'region_code_unique', unique: true, columns: ['code']
    })
    // … and split_bill hardening (NOT NULL + idempotencyKey + index).
    const nullable = await q2("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='split_bill' AND column_name='status'")
    expect(nullable[0].is_nullable).toBe('NO')
    const idx = await q2("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='split_bill_order_idempotencykey'")
    expect(idx.map((r) => r.indexname)).toEqual(['split_bill_order_idempotencykey'])
  })

  test('CAP-003-T3. stale manifest SHA refuses before any mutation', async () => {
    const fix = cap003Manifest([REVIEW_MIGRATION])
    const idxBefore = await q2("SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")
    const swapToShaB = () => {
      const fresh = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
      fresh.migrations[0].evidenceRef = 'cap003 swapped by another process'
      writeManifest(fix.manifestPath, fresh)
    }
    await expect(ctl.runControlledApply(cap003Opts(fix, REVIEW_MIGRATION, 'cap003-t3', {
      _hooks: { afterLockAcquire: swapToShaB }
    }))).rejects.toThrow(/manifest changed since authorization/)
    // No manifest overwrite: the SHA-B content is byte-identical to the swap.
    const after = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(after.migrations[0].disposition).toBe('CONTROLLED_APPLY_PENDING')
    expect(after.migrations[0].evidenceRef).toBe('cap003 swapped by another process')
    expect(after.migrations[0].applyRef).toBeUndefined()
    // Zero DB mutation: refusal happens before the write transaction opens,
    // so the index set is unchanged (snapshot comparison, order-independent
    // of whatever earlier tests created).
    const idxAfter = await q2("SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")
    expect(idxAfter.map((r) => r.indexname)).toEqual(idxBefore.map((r) => r.indexname))
  })

  test('CAP-003-T4. stale target row refuses: no duplicate transition, no overwrite', async () => {
    const fix = cap003Manifest([REVIEW_MIGRATION])
    const winnerRef = 'controlled-apply/20260829000001-create-product-review-table.js/2026-10-06T00:00:00.000Z/winner'
    const flipToApplied = () => {
      const fresh = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
      fresh.migrations[0].disposition = 'CONTROLLED_APPLIED'
      fresh.migrations[0].applyRef = winnerRef
      writeManifest(fix.manifestPath, fresh)
    }
    // The "other process" transition lands after our DB commit but before
    // our ledger write — the CAS re-read must see it and refuse.
    await expect(ctl.runControlledApply(cap003Opts(fix, REVIEW_MIGRATION, 'cap003-t4', {
      _hooks: { afterCommitBeforeCas: flipToApplied }
    }))).rejects.toThrow(/refusing stale manifest write/)
    const saved = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(saved.migrations[0].disposition).toBe('CONTROLLED_APPLIED')
    expect(saved.migrations[0].applyRef).toBe(winnerRef)
    expect(rules.validateDispositionManifest(saved, { files: [REVIEW_MIGRATION], environment: 'production' }).ok).toBe(true)
  })

  test('CAP-003-T5. CAS race: a stale read cannot overwrite a newer manifest write', async () => {
    const fix = cap003Manifest([REVIEW_MIGRATION])
    let releaseA
    const gate = new Promise((r) => { releaseA = r })
    const base = {
      manifestPath: fix.manifestPath,
      expectedSha: fix.sha,
      files: [REVIEW_MIGRATION],
      environment: 'production'
    }
    // A reads the manifest, then parks inside CAS while B completes.
    const promiseA = ctl.casUpdateManifestRow({
      ...base, migration: REVIEW_MIGRATION, applyRef: 'controlled-apply/A', _hooks: { casAfterRead: () => gate }
    })
    const nextB = await ctl.casUpdateManifestRow({
      ...base, migration: REVIEW_MIGRATION, applyRef: 'controlled-apply/B'
    })
    expect(nextB.migrations[0].applyRef).toBe('controlled-apply/B')
    releaseA()
    await expect(promiseA).rejects.toThrow(/manifest changed since authorization/)
    // The newer state is intact: exactly B's write, not A's stale content.
    const saved = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(saved.migrations[0].disposition).toBe('CONTROLLED_APPLIED')
    expect(saved.migrations[0].applyRef).toBe('controlled-apply/B')
  })

  test('CAP-003-T6. retry after refusal re-reads latest state and converges', async () => {
    const fix = cap003Manifest([REVIEW_MIGRATION])
    const swapToShaB = () => {
      const fresh = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
      fresh.migrations[0].evidenceRef = 'cap003 refreshed authorization base'
      writeManifest(fix.manifestPath, fresh)
    }
    await expect(ctl.runControlledApply(cap003Opts(fix, REVIEW_MIGRATION, 'cap003-t6a', {
      _hooks: { afterLockAcquire: swapToShaB }
    }))).rejects.toThrow(/manifest changed since authorization/)
    // Retry against the LATEST state (fresh read + fresh SHA): safe, no
    // stale in-memory snapshot reused, idempotent DDL converges.
    const latest = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    const latestSha = rules.sha256OfFile(fix.manifestPath)
    const retry = await ctl.runControlledApply({
      ...cap003Opts(fix, REVIEW_MIGRATION, 'cap003-t6b'),
      manifest: latest,
      manifestSha: latestSha,
      backupEvidencePath: fixtureBackup(dir, DISPOSABLE_DB2, latestSha)
    })
    expect(retry.status).toBe('ok')
    expect(retry.dispositionAfter).toBe('CONTROLLED_APPLIED')
    const saved = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(saved.migrations[0].disposition).toBe('CONTROLLED_APPLIED')
    expect(saved.migrations[0].applyRef).toBe(retry.applyRef)
  })
})

// ---------- CAP-004 evidence integrity (increment 1) ----------
//
// Destination isolation, versioned contract, authorized/resulting SHA
// binding, pure validator. No sleeps, no mocks of fs/DB: real temp files,
// real disposable PostgreSQL, real core path. main() is invoked only for
// the pre-mutation refusal case (never reaches any DB connection).

describe('CAP-004 evidence integrity', () => {
  const DISPOSABLE_DB4 = `cashier_app_cap004_${process.pid}`
  let sequelize4
  let dir

  function cap004Manifest(migrations) {
    const manifest = {
      schemaVersion: 1,
      environment: 'production',
      evidenceCapturedAt: '2026-10-05T18:29:17.353Z',
      approvedBy: 'cap004-approver',
      approvedAt: '2026-10-05T19:00:00.000Z',
      migrations: [...migrations].sort().map((m) => ({
        migration: m,
        disposition: 'CONTROLLED_APPLY_PENDING',
        evidenceRef: 'cap004 fixture'
      }))
    }
    const manifestPath = path.join(dir, `cap004-manifest-${crypto.randomBytes(4).toString('hex')}.json`)
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    return { manifest, manifestPath, sha: rules.sha256OfFile(manifestPath) }
  }

  function cap004Opts(fix, migration, operator, extra = {}) {
    return {
      sequelize: sequelize4,
      expectedDatabase: DISPOSABLE_DB4,
      manifestPath: fix.manifestPath,
      manifest: JSON.parse(JSON.stringify(fix.manifest)),
      files: fix.manifest.migrations.map((r) => r.migration),
      environment: 'production',
      migration,
      authorizationRef: 'CHG-2026-004',
      backupEvidencePath: fixtureBackup(dir, DISPOSABLE_DB4, fix.sha),
      manifestSha: fix.sha,
      operator,
      apply: true,
      confirm: migration,
      ...extra
    }
  }

  function goldenApplied(overrides = {}) {
    return {
      schemaVersion: 1,
      outcome: 'applied',
      mode: 'apply',
      authorizedManifestSha: 'a'.repeat(64),
      resultingManifestSha: 'a'.repeat(64),
      migration: REVIEW_MIGRATION,
      kind: 'product-review-indexes',
      environment: 'production',
      databaseIdentity: DISPOSABLE_DB4,
      operator: 'cap004-tester',
      authorizationRef: 'CHG-2026-004',
      backupRef: 'db_backup#1 backup_fixture.dump',
      startedAt: '2026-10-06T00:00:00.000Z',
      endedAt: '2026-10-06T00:00:01.000Z',
      preconditions: [{ name: 'product_review.table-exists', passed: true, detail: 'x' }],
      applied: ['product_review_product_store', 'product_review_store'],
      postcondition: 'verified-in-transaction',
      dispositionBefore: 'CONTROLLED_APPLY_PENDING',
      dispositionAfter: 'CONTROLLED_APPLIED',
      applyRef: 'controlled-apply/x',
      status: 'ok',
      ...overrides
    }
  }

  beforeAll(async () => {
    const createdb = spawnSync('createdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, DISPOSABLE_DB4], { encoding: 'utf8' })
    if (createdb.status !== 0) throw new Error(`createdb failed: ${createdb.stderr}`)
    sequelize4 = new Sequelize({
      dialect: 'postgres', host: DB_HOST, port: DB_PORT,
      username: DB_USER, database: DISPOSABLE_DB4, logging: false
    })
    await sequelize4.query('CREATE TABLE region ("id" SERIAL PRIMARY KEY, "code" VARCHAR(20) NOT NULL, "level" VARCHAR(10) NOT NULL, "parentCode" VARCHAR(20), "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW())')
    await sequelize4.query('CREATE TABLE product_review ("id" SERIAL PRIMARY KEY, "productId" INTEGER NOT NULL, "store" INTEGER, "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())')
    await sequelize4.query('CREATE TABLE "order" ("id" SERIAL PRIMARY KEY)')
    await sequelize4.query('CREATE TABLE split_bill ("id" SERIAL PRIMARY KEY, "order" INTEGER, "status" VARCHAR(20), "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())')
    await sequelize4.query('CREATE TABLE "SequelizeMeta" ("name" VARCHAR(255) PRIMARY KEY)')
    await sequelize4.query("INSERT INTO region (code, level) VALUES ('ID-JK', 'province'), ('ID-JK-01', 'city')")
    await sequelize4.query("INSERT INTO split_bill (\"order\", status) VALUES (NULL, 'pending')")
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-cap004-'))
  }, 60000)

  afterAll(async () => {
    if (sequelize4) await sequelize4.close().catch(() => {})
    spawnSync('dropdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, DISPOSABLE_DB4])
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  test('CAP-004-T1. destination guard rejects manifest-equivalent paths (canonical, not string compare)', () => {
    const manifestPath = path.join(dir, 'manifest.json')
    fs.writeFileSync(manifestPath, '{}\n')
    const clash = (evidenceOut) => ctl.evidenceOutTargetsManifest({ manifestPath, evidenceOut })
    // Exact canonical path.
    expect(clash(manifestPath)).toBe(true)
    // Relative equivalent from the temp dir.
    const rel = path.relative(process.cwd(), manifestPath)
    expect(rel).not.toBe(manifestPath)
    expect(clash(rel)).toBe(true)
    // ./ -prefixed and ../ -normalized equivalents.
    expect(clash(`./${rel}`)).toBe(true)
    expect(clash(path.join(dir, 'sub', '..', 'manifest.json'))).toBe(true)
    // Symlink-equivalent (real symlink on disk).
    const linkPath = path.join(dir, 'manifest-link.json')
    try { fs.unlinkSync(linkPath) } catch {}
    fs.symlinkSync(manifestPath, linkPath)
    expect(clash(linkPath)).toBe(true)
    // Unrelated destinations are allowed.
    expect(clash(path.join(dir, 'evidence.json'))).toBe(false)
    expect(clash(path.join(dir, 'manifest-backup.json'))).toBe(false)
    expect(clash(null)).toBe(false)
    expect(clash(undefined)).toBe(false)
  })

  test('CAP-004-T2. main() refuses a manifest-targeted evidence-out before any mutation', async () => {
    const prodManifest = ctl.resolveProductionManifestPath()
    const before = fs.readFileSync(prodManifest, 'utf8')
    const prevExit = process.exitCode
    const prevError = console.error
    const prevLog = console.log
    let stderr = ''
    let stdout = ''
    console.error = (m) => { stderr += `${m}\n` }
    console.log = (m) => { stdout += `${m}\n` }
    try {
      // Deliberately wrong SHA: pre-fix code also refuses (Gate 3), but for
      // the wrong reason — the message assertion is what proves the guard.
      await ctl.main([
        '--target=production',
        `--migration=${SPLIT_MIGRATION}`,
        '--authorization-ref=CHG-2026-004',
        '--operator=cap004-t2',
        '--backup-evidence=/tmp/does-not-matter.json',
        '--apply',
        `--authorize-manifest-sha256=${'0'.repeat(64)}`,
        `--confirm=${SPLIT_MIGRATION}`,
        `--evidence-out=${prodManifest}`
      ])
      expect(process.exitCode).toBe(1)
      expect(stderr).toMatch(/evidence-out/)
    } finally {
      process.exitCode = prevExit
      console.error = prevError
      console.log = prevLog
    }
    expect(stdout).not.toMatch(/APPLIED/)
    // Zero mutation: the production manifest is byte-identical.
    expect(fs.readFileSync(prodManifest, 'utf8')).toBe(before)
  })

  test('CAP-004-T3. successful apply evidence binds authorized + resulting SHAs from disk', async () => {
    const fix = cap004Manifest([REVIEW_MIGRATION])
    const evidence = await ctl.runControlledApply(cap004Opts(fix, REVIEW_MIGRATION, 'cap004-t3'))
    expect(evidence.schemaVersion).toBe(1)
    expect(evidence.outcome).toBe('applied')
    // Authorized SHA is the pre-apply authorized state …
    expect(evidence.authorizedManifestSha).toBe(fix.sha)
    expect('manifestSha' in evidence).toBe(false)
    // … and the resulting SHA is independently recomputed from disk bytes.
    expect(evidence.resultingManifestSha).toBe(rules.sha256OfFile(fix.manifestPath))
    expect(evidence.resultingManifestSha).not.toBe(fix.sha)
    // The ledger actually transitioned under the returned applyRef.
    const saved = JSON.parse(fs.readFileSync(fix.manifestPath, 'utf8'))
    expect(saved.migrations[0].disposition).toBe('CONTROLLED_APPLIED')
    expect(saved.migrations[0].applyRef).toBe(evidence.applyRef)
    // The produced evidence satisfies its own contract.
    expect(ctl.validateApplyEvidence(evidence).ok).toBe(true)
  })

  test('CAP-004-T4. dry-run evidence carries no resulting SHA and writes nothing', async () => {
    const fix = cap004Manifest([REVIEW_MIGRATION])
    const manifestBefore = fs.readFileSync(fix.manifestPath, 'utf8')
    const evidence = await ctl.runControlledApply({ ...cap004Opts(fix, REVIEW_MIGRATION, 'cap004-t4'), apply: false })
    expect(evidence.outcome).toBe('dry-run-ok')
    expect(evidence.resultingManifestSha).toBeNull()
    expect(evidence.authorizedManifestSha).toBe(fix.sha)
    expect(evidence.applyRef).toBeNull()
    expect(fs.readFileSync(fix.manifestPath, 'utf8')).toBe(manifestBefore)
    expect(ctl.validateApplyEvidence(evidence).ok).toBe(true)
  })

  test('CAP-004-T5. validator accepts golden evidence, including equal SHAs', () => {
    expect(ctl.validateApplyEvidence(goldenApplied()).ok).toBe(true)
    // Equality of the two SHAs is NOT invalid per the locked correction:
    // the validator checks format/presence/role, not inequality.
    expect(ctl.validateApplyEvidence(goldenApplied({
      authorizedManifestSha: 'c'.repeat(64),
      resultingManifestSha: 'c'.repeat(64)
    })).ok).toBe(true)
    expect(ctl.validateApplyEvidence({
      ...goldenApplied(),
      outcome: 'dry-run-ok',
      mode: 'dry-run',
      resultingManifestSha: null,
      applied: [],
      postcondition: 'not-executed-dry-run',
      dispositionAfter: 'CONTROLLED_APPLY_PENDING',
      applyRef: null
    }).ok).toBe(true)
  })

  test('CAP-004-T6. validator rejects malformed and fabricated evidence', () => {
    const cases = [
      ['missing schemaVersion', (r) => { const n = { ...r }; delete n.schemaVersion; return n }],
      ['unsupported schemaVersion', (r) => ({ ...r, schemaVersion: 2 })],
      ['malformed authorizedManifestSha', (r) => ({ ...r, authorizedManifestSha: 'xyz' })],
      ['missing resultingManifestSha on applied', (r) => ({ ...r, resultingManifestSha: null })],
      ['malformed resultingManifestSha on applied', (r) => ({ ...r, resultingManifestSha: 'nope' })],
      ['missing applyRef on applied', (r) => ({ ...r, applyRef: null })],
      ['missing operator', (r) => ({ ...r, operator: '' })],
      ['missing migration', (r) => ({ ...r, migration: '' })],
      ['invalid startedAt', (r) => ({ ...r, startedAt: 'yesterday' })],
      ['invalid outcome', (r) => ({ ...r, outcome: 'maybe' })],
      ['mode/outcome mismatch', (r) => ({ ...r, mode: 'dry-run' })],
      ['empty applied list on applied', (r) => ({ ...r, applied: [] })]
    ]
    for (const [name, mutate] of cases) {
      const result = ctl.validateApplyEvidence(mutate(goldenApplied()))
      expect({ name, ok: result.ok, errors: result.errors }).toEqual({ name, ok: false, errors: expect.any(Array) })
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  test('CAP-004-T7. evidence-out write validates first: invalid evidence never persisted', () => {
    const target = path.join(dir, `evidence-${crypto.randomBytes(4).toString('hex')}.json`)
    ctl.writeEvidenceOut(target, goldenApplied())
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual(goldenApplied())
    const badTarget = path.join(dir, `evidence-bad-${crypto.randomBytes(4).toString('hex')}.json`)
    expect(() => ctl.writeEvidenceOut(badTarget, goldenApplied({ resultingManifestSha: null })))
      .toThrow(/evidence/i)
    expect(fs.existsSync(badTarget)).toBe(false)
  })

  test('CAP-004-T8. legacy meta fields are gone from produced evidence', async () => {
    const fix = cap004Manifest([REVIEW_MIGRATION])
    const applied = await ctl.runControlledApply(cap004Opts(fix, REVIEW_MIGRATION, 'cap004-t8'))
    for (const field of ['metaBefore', 'metaAfter', 'metaChanged']) {
      expect(applied).not.toHaveProperty(field)
    }
    const fix2 = cap004Manifest([REVIEW_MIGRATION])
    const dry = await ctl.runControlledApply({ ...cap004Opts(fix2, REVIEW_MIGRATION, 'cap004-t8'), apply: false })
    for (const field of ['metaBefore', 'metaAfter', 'metaChanged']) {
      expect(dry).not.toHaveProperty(field)
    }
  })
})
