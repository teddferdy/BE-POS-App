process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// W-01.1 — production migration disposition manifest + stamper.
// Pure manifest rules run without a database. Stamping runs ONLY against the
// isolated test database (jest globalSetup), on a disposable per-process
// ledger table — never the test DB's real SequelizeMeta, never production.
const fs = require('fs')
const os = require('os')
const path = require('path')

const rules = require('../scripts/migration-dispositions')
const stamper = require('../scripts/apply-migration-dispositions')
const { discoverMigrationFiles } = require('../scripts/check-production-schema')

const FILES = discoverMigrationFiles()

function manifestWith(rows, overrides = {}) {
  return {
    schemaVersion: 1,
    environment: 'production',
    evidenceCapturedAt: '2026-10-01T17:08:46Z',
    approvedBy: 'reviewer@example.test',
    approvedAt: '2026-10-02T00:00:00Z',
    migrations: rows,
    ...overrides
  }
}
const row = (migration, disposition = 'ATTESTED_PRESENT', extra = {}) => ({
  migration,
  disposition,
  evidenceRef: 'fixture evidence',
  ...extra
})
const validate = (m) => rules.validateDispositionManifest(m, { files: FILES, environment: 'production' })

describe('W-01.1 disposition manifest validation', () => {
  test('valid manifest', () => {
    const r = validate(manifestWith([row(FILES[0]), row(FILES[1], 'EXCLUDED_UNSAFE')]))
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.approved).toBe(true)
  })

  test('malformed JSON is reported as an error (fail closed), not thrown', () => {
    const tmp = path.join(os.tmpdir(), `w011-malformed-${process.pid}.json`)
    fs.writeFileSync(tmp, '{ "schemaVersion": 1, ')
    try {
      const { manifest, errors } = rules.readDispositionManifest(tmp)
      expect(manifest).toBeNull()
      expect(errors.join('\n')).toMatch(/malformed JSON/)
    } finally {
      fs.unlinkSync(tmp)
    }
  })

  test('duplicate migration rows are invalid', () => {
    const r = validate(manifestWith([row(FILES[0]), row(FILES[0])]))
    expect(r.ok).toBe(false)
    expect(r.errors.join('\n')).toMatch(/duplicate manifest entry/)
  })

  test('unknown migration is invalid', () => {
    const r = validate(manifestWith([row('20990101000000-not-a-file.js')]))
    expect(r.ok).toBe(false)
    expect(r.errors.join('\n')).toMatch(/unknown migration/)
  })

  test('timestamp-only or non-exact names are invalid', () => {
    const r = validate(manifestWith([row('20260616000002')]))
    expect(r.ok).toBe(false)
    expect(r.errors.join('\n')).toMatch(/exact migration filename/)
  })

  test('missing evidenceRef is invalid', () => {
    const r = validate(manifestWith([{ migration: FILES[0], disposition: 'ATTESTED_PRESENT' }]))
    expect(r.ok).toBe(false)
    expect(r.errors.join('\n')).toMatch(/evidenceRef is required/)
  })

  test('invalid disposition is invalid', () => {
    const r = validate(manifestWith([row(FILES[0], 'EXECUTED')]))
    expect(r.ok).toBe(false)
    expect(r.errors.join('\n')).toMatch(/invalid disposition "EXECUTED"/)
  })

  test('EXCLUDED_SUPERSEDED requires supersededBy', () => {
    const r = validate(manifestWith([row(FILES[0], 'EXCLUDED_SUPERSEDED')]))
    expect(r.ok).toBe(false)
    expect(r.errors.join('\n')).toMatch(/requires supersededBy/)
  })

  test('supersededBy must be an existing, LATER migration', () => {
    const notAFile = validate(manifestWith([row(FILES[0], 'EXCLUDED_SUPERSEDED', { supersededBy: '20990101000000-x.js' })]))
    expect(notAFile.errors.join('\n')).toMatch(/is not a repository migration/)
    const earlier = validate(manifestWith([row(FILES[5], 'EXCLUDED_SUPERSEDED', { supersededBy: FILES[1] })]))
    expect(earlier.errors.join('\n')).toMatch(/must be a later migration/)
    const self = validate(manifestWith([row(FILES[5], 'EXCLUDED_SUPERSEDED', { supersededBy: FILES[5] })]))
    expect(self.errors.join('\n')).toMatch(/must be a later migration/)
    const ok = validate(manifestWith([row(FILES[1], 'EXCLUDED_SUPERSEDED', { supersededBy: FILES[5] })]))
    expect(ok.ok).toBe(true)
  })

  test('BLOCKED_DECISION and EXCLUDED_BY_DECISION require decisionRef (with a decision id)', () => {
    expect(validate(manifestWith([row(FILES[0], 'BLOCKED_DECISION')])).errors.join('\n')).toMatch(/requires decisionRef/)
    expect(validate(manifestWith([row(FILES[0], 'EXCLUDED_BY_DECISION')])).errors.join('\n')).toMatch(/requires decisionRef/)
    expect(
      validate(manifestWith([row(FILES[0], 'BLOCKED_DECISION', { decisionRef: 'member uniqueness' })])).errors.join('\n')
    ).toMatch(/decision id/)
    expect(validate(manifestWith([row(FILES[0], 'BLOCKED_DECISION', { decisionRef: 'D-05 member' })])).ok).toBe(true)
  })

  test('CONTROLLED_APPLIED requires applyRef; CONTROLLED_APPLY_PENDING must not carry one', () => {
    expect(validate(manifestWith([row(FILES[0], 'CONTROLLED_APPLIED')])).errors.join('\n')).toMatch(/requires applyRef/)
    expect(
      validate(manifestWith([row(FILES[0], 'CONTROLLED_APPLY_PENDING', { applyRef: 'x' })])).errors.join('\n')
    ).toMatch(/applyRef is not allowed/)
    expect(validate(manifestWith([row(FILES[0], 'CONTROLLED_APPLIED', { applyRef: 'apply-1' })])).ok).toBe(true)
  })

  test('conditional fields are rejected where they do not belong; unknown fields rejected', () => {
    expect(
      validate(manifestWith([row(FILES[0], 'ATTESTED_PRESENT', { supersededBy: FILES[3] })])).errors.join('\n')
    ).toMatch(/supersededBy is not allowed/)
    expect(validate(manifestWith([row(FILES[0], 'ATTESTED_PRESENT', { approvedBy: 'x' })])).errors.join('\n')).toMatch(
      /unknown field "approvedBy"/
    )
  })

  test('approval is all-or-nothing; environment, ordering and schemaVersion enforced', () => {
    expect(validate(manifestWith([row(FILES[0])], { approvedAt: null })).errors.join('\n')).toMatch(/both be null/)
    const pending = validate(manifestWith([row(FILES[0])], { approvedBy: null, approvedAt: null }))
    expect(pending.ok).toBe(true)
    expect(pending.approved).toBe(false)
    expect(validate(manifestWith([row(FILES[0])], { environment: 'staging' })).errors.join('\n')).toMatch(/environment/)
    expect(validate(manifestWith([row(FILES[1]), row(FILES[0])])).errors.join('\n')).toMatch(/sorted/)
    expect(validate(manifestWith([row(FILES[0])], { schemaVersion: 2 })).errors.join('\n')).toMatch(/schemaVersion/)
  })
})

describe('W-01.1 repository production manifest (locked W-02R.3R matrix v2)', () => {
  const { manifest, errors } = rules.readDispositionManifest()
  const r = rules.validateDispositionManifest(manifest, { files: FILES, environment: 'production' })

  test('is valid, approved as a whole, and holds exactly 197 rows', () => {
    expect(errors).toEqual([])
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
    // Formal production manifest approval (PR review sets approvedBy/approvedAt).
    expect(r.approved).toBe(true)
    expect(manifest.approvedBy).toBe('teddy-ferdian')
    expect(manifest.approvedAt).toBe('2026-10-05T16:57:23Z')
    expect(manifest.evidenceCapturedAt).toBe('2026-10-01T17:08:46Z')
    expect(Date.parse(manifest.approvedAt) >= Date.parse(manifest.evidenceCapturedAt)).toBe(true)
    expect(r.names).toHaveLength(197)
  })

  test('disposition counts match the locked matrix (E1 177 + E3 5 + E4 6 + E5 4 + E6 5, all E6 decisions recorded)', () => {
    expect(r.byDisposition).toEqual({
      ATTESTED_PRESENT: 179, // 177 E1 + 2 E3 whose missing half is superseded
      CONTROLLED_APPLY_PENDING: 1, // 1 E3 still needing a controlled apply (CAP #1 region + CAP #2 product-review APPLIED)
      CONTROLLED_APPLIED: 2, // CAP #1 region + CAP #2 product-review, verified production CAS
      EXCLUDED_UNSAFE: 6, // E4
      EXCLUDED_SUPERSEDED: 4, // E5
      // E6 fully decided: D-05 (20260620000004 + 20260913000001, superseded by
      // the product-grade D-05 migration), DR-21 (tax_config audit type kept
      // INTEGER) and DR-06 (seed accounts prohibited: 20260618000004 +
      // 20260620000005). No BLOCKED_DECISION row remains (validator omits zero
      // counts); BLOCKED gate behaviour is covered by synthetic fixtures.
      EXCLUDED_BY_DECISION: 5
    })
    expect(r.byDisposition.BLOCKED_DECISION).toBeUndefined()
    expect(manifest.migrations.filter((m) => m.disposition === 'BLOCKED_DECISION')).toEqual([])
  })

  test('the 13 E2 migrations are intentionally absent (they run through the runner)', () => {
    const e2 = [
      '20260613000003-insert-default-roles.js',
      '20260810000002-add-goods-request-menu-access.js',
      '20260827000004-add-my-shift-access-menu.js',
      '20260902000002-add-business-trip-menu-access.js',
      '20261001000001-purchase-monetary-bigint.js',
      '20261001000002-goods-receipt-item-qty-decimal.js',
      '20261001000003-goods-receipt-idempotency.js',
      '20261002000001-fractional-stock-decimal.js',
      '20261004000001-stock-opname-decimal.js',
      '20261006000001-stock-transfer-idempotency-decimal.js',
      '20261007000001-add-dr20-foundation-fields-to-audit-log.js',
      '20261011000001-add-reactivated-at-to-tenant-membership.js',
      '20261012000001-d05-member-identity-uniqueness.js'
    ]
    for (const name of e2) {
      expect(FILES).toContain(name)
      expect(r.names).not.toContain(name)
    }
  })

  test('E5/E6 rows carry their required references exactly', () => {
    const by = Object.fromEntries(manifest.migrations.map((m) => [m.migration, m]))
    expect(by['20260601000001-change-product-store-to-jsonb.js'].supersededBy).toBe('20260718000001-create-product-store.js')
    expect(by['20260827000001-change-shift-store-to-jsonb.js'].supersededBy).toBe('20260827000002-revert-shift-store-to-integer.js')
    expect(by['20260616000002-fix-tax-config-audit-fields-type.js'].decisionRef).toMatch(/^DR-21\b/)
    expect(by['20260620000004-add-unique-constraints-to-member.js'].decisionRef).toMatch(/^D-05/)
    expect(by['20260913000001-member-name-store-scoped-uniqueness.js'].decisionRef).toMatch(/^D-05/)
    expect(by['20260618000004-create-super-admin-users.js'].decisionRef).toMatch(/^DR-06\b/)
    expect(by['20260620000005-create-dev-user.js'].decisionRef).toMatch(/^DR-06\b/)
    // The three former BLOCKED rows are excluded by recorded decisions, and
    // none of them is described as a safe no-op: each would mutate production
    // if executed (seed rows would create privileged accounts).
    for (const name of [
      '20260616000002-fix-tax-config-audit-fields-type.js',
      '20260618000004-create-super-admin-users.js',
      '20260620000005-create-dev-user.js'
    ]) {
      expect(by[name].disposition).toBe('EXCLUDED_BY_DECISION')
      expect(by[name].evidenceRef).not.toMatch(/SAFE_NOOP/)
      expect(by[name].evidenceRef).toMatch(/NOT a safe no-op/)
    }
    // Timestamp collision: the twin of the tax file is attested, not blocked.
    expect(by['20260616000002-add-ingredient-to-goods-receipt-item.js'].disposition).toBe('ATTESTED_PRESENT')
    // DOC 2 correction: replay would drop the live showLogo column.
    expect(by['20260610000000-remove-invoice-footer-logo-social.js'].disposition).toBe('EXCLUDED_UNSAFE')
  })

  test('is not db/migration-baseline.txt (separate concept, separate file)', () => {
    expect(rules.PRODUCTION_DISPOSITIONS_PATH).not.toMatch(/migration-baseline/)
  })
})

describe('W-01.1 stamper CLI argument contract (no database)', () => {
  test('no target → refused (no default)', () => {
    expect(() => stamper.parseArgs([])).toThrow(/--target=<environment> is required/)
  })
  test('ambiguous/unknown target → refused (W-02R.4: staging is now a valid target)', () => {
    expect(() => stamper.parseArgs(['--target=bogus'])).toThrow(/no disposition manifest exists for target "bogus"/)
    expect(() => stamper.parseArgs(['--target=stagingg'])).toThrow(/no disposition manifest exists/)
    // Staging is an explicit, disjoint target — accepted, dry-run by default.
    expect(stamper.parseArgs(['--target=staging'])).toEqual({ target: 'staging', apply: false, authorizeSha256: null })
    expect(stamper.MANIFEST_BY_TARGET.production).not.toBe(stamper.MANIFEST_BY_TARGET.staging)
  })
  test('default invocation for production is a dry run', () => {
    expect(stamper.parseArgs(['--target=production'])).toEqual({ target: 'production', apply: false, authorizeSha256: null })
  })
  test('--apply without a manifest sha256 authorization → refused', () => {
    expect(() => stamper.parseArgs(['--target=production', '--apply'])).toThrow(/requires --authorize-manifest-sha256/)
    expect(() => stamper.parseArgs(['--target=production', '--apply', '--authorize-manifest-sha256=abc'])).toThrow(
      /requires --authorize-manifest-sha256/
    )
  })
  test('unknown flags → refused', () => {
    expect(() => stamper.parseArgs(['--target=production', '--force'])).toThrow(/unknown argument/)
  })
})

describe('W-01.1 stamper on the isolated TEST database only', () => {
  const db = require('../db/models')
  const TABLE = `w011_meta_probe_${process.pid}`
  const EXPECTED_DB = process.env.DB_TEST_DATABASE || 'cashier_app_test'

  const ledger = async () =>
    (await db.sequelize.query(`SELECT name FROM "${TABLE}" ORDER BY name`, { type: db.sequelize.QueryTypes.SELECT })).map(
      (r) => r.name
    )
  const seed = async (names) => {
    await db.sequelize.query(`TRUNCATE "${TABLE}"`)
    for (const n of names) await db.sequelize.query(`INSERT INTO "${TABLE}" (name) VALUES ($1)`, { bind: [n] })
  }
  const stamp = (manifest, apply) =>
    stamper.stampDispositions({ sequelize: db.sequelize, manifest, files: FILES, environment: 'production', apply, metaTable: TABLE })

  beforeAll(async () => {
    // Binding safety gate: refuse anything that is not the isolated test DB.
    expect(process.env.NODE_ENV).toBe('test')
    const [{ name }] = await db.sequelize.query('SELECT current_database() AS name', { type: db.sequelize.QueryTypes.SELECT })
    expect(name).toBe(EXPECTED_DB)
    expect(name).toMatch(/_test$/)
    await db.sequelize.query(`CREATE TABLE "${TABLE}" (name VARCHAR(255) NOT NULL PRIMARY KEY)`)
  })

  afterAll(async () => {
    await db.sequelize.query(`DROP TABLE IF EXISTS "${TABLE}"`)
  })

  const fixture = () => manifestWith([row(FILES[0]), row(FILES[1], 'EXCLUDED_UNSAFE'), row(FILES[2], 'BLOCKED_DECISION', { decisionRef: 'D-05 t' })])

  test('dry run performs no writes', async () => {
    await seed([FILES[0]])
    const result = await stamp(fixture(), false)
    expect(result.mode).toBe('dry-run')
    expect(result.toInsert).toEqual([FILES[1], FILES[2]])
    expect(await ledger()).toEqual([FILES[0]])
  })

  test('authorized stamp inserts only the missing rows; existing rows unchanged', async () => {
    await seed([FILES[0], FILES[10]])
    const result = await stamp(fixture(), true)
    expect(result.mode).toBe('apply')
    expect(result.inserted).toEqual([FILES[1], FILES[2]])
    expect(await ledger()).toEqual([FILES[0], FILES[1], FILES[2], FILES[10]])
  })

  test('repeated stamp is idempotent', async () => {
    const before = await ledger()
    const result = await stamp(fixture(), true)
    expect(result.inserted).toEqual([])
    expect(await ledger()).toEqual(before)
  })

  test('unapproved manifest: mutation refused, no writes', async () => {
    await seed([])
    await expect(stamp(manifestWith(fixture().migrations, { approvedBy: null, approvedAt: null }), true)).rejects.toThrow(
      /not approved/
    )
    expect(await ledger()).toEqual([])
  })

  test('malformed manifest: refused, no writes', async () => {
    await seed([])
    await expect(stamp({ schemaVersion: 1, migrations: 'nope' }, true)).rejects.toThrow(/manifest invalid/)
    expect(await ledger()).toEqual([])
  })

  test('orphan (unknown) manifest row: refused, no writes', async () => {
    await seed([])
    await expect(stamp(manifestWith([row('20990101000000-orphan.js')]), true)).rejects.toThrow(/unknown migration/)
    expect(await ledger()).toEqual([])
  })

  test('duplicate manifest row: refused, no writes', async () => {
    await seed([])
    await expect(stamp(manifestWith([row(FILES[0]), row(FILES[0])]), true)).rejects.toThrow(/duplicate manifest entry/)
    expect(await ledger()).toEqual([])
  })

  test('orphan ledger row (no migration file): refused, no writes', async () => {
    await seed(['29991231000000-orphan.js'])
    await expect(stamp(fixture(), true)).rejects.toThrow(/rows with no migration file/)
    expect(await ledger()).toEqual(['29991231000000-orphan.js'])
  })

  test('partial failure rolls back the whole stamp', async () => {
    await seed([FILES[0]])
    // Make exactly one of the to-be-inserted names fail at the database.
    await db.sequelize.query(`ALTER TABLE "${TABLE}" ADD CONSTRAINT w011_reject CHECK (name <> '${FILES[2]}')`)
    try {
      await expect(stamp(fixture(), true)).rejects.toThrow()
      expect(await ledger()).toEqual([FILES[0]])
    } finally {
      await db.sequelize.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT w011_reject`)
    }
  })

  test('approved copy of the repository manifest stamps all 197 rows once; a second run inserts nothing', async () => {
    await seed([])
    const { manifest } = rules.readDispositionManifest()
    const approved = { ...manifest, approvedBy: 'reviewer@example.test', approvedAt: '2026-10-02T00:00:00Z' }
    const first = await stamp(approved, true)
    expect(first.inserted).toHaveLength(197)
    const second = await stamp(approved, true)
    expect(second.inserted).toHaveLength(0)
    expect(await ledger()).toHaveLength(197)
  })
})
