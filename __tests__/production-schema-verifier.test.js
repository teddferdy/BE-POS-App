process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

// W-01 — production schema verifier tests (TDD RED first).
// Uses the isolated test database (jest globalSetup) only for the
// read-only/write-rejection proof (Test D) and for confirming the real
// test schema carries the critical columns. Migration/column absence
// cases (B/C) and baseline handling (E) simulate state through the
// verifier's pure functions so no production migration is ever executed.
const path = require('path')

const VERIFIER_PATH = '../scripts/check-production-schema'

describe('W-01 production schema verifier', () => {
  let verifier
  beforeAll(() => {
    verifier = require(VERIFIER_PATH)
  })

  function completeState() {
    const files = verifier.discoverMigrationFiles()
    const manifest = verifier.readMigrationManifest()
    return { files, manifest, metaNames: [...files], schema: verifier.completeTestSchema() }
  }

  test('Test A — pass: schema matching expected migration/critical-column state passes', () => {
    const state = completeState()
    const result = verifier.verifyFromState(state)
    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
  })

  test('Test B — missing migration: verifier detects unapplied file and fails', () => {
    const state = completeState()
    const removed = '20261011000001-add-reactivated-at-to-tenant-membership.js'
    expect(state.files).toContain(removed)
    const metaNames = state.metaNames.filter((n) => n !== removed)
    const result = verifier.verifyFromState({ ...state, metaNames })
    expect(result.ok).toBe(false)
    const joined = result.failures.join('\n')
    expect(joined).toMatch(/missing|unapplied/i)
    expect(joined).toContain(removed)
    // Non-zero exit mapping: CLI exits 1 when ok === false.
    expect(result.ok ? 0 : 1).toBe(1)
  })

  test('Test C — missing critical column: verifier detects absent column and fails', () => {
    const state = completeState()
    const schema = { ...state.schema }
    // Simulate user.disabledAt absent.
    schema['user'] = new Set([...schema['user']].filter((c) => c !== 'disabledAt'))
    const result = verifier.verifyFromState({ ...state, schema })
    expect(result.ok).toBe(false)
    const joined = result.failures.join('\n')
    expect(joined).toMatch(/disabledAt/)
    expect(joined).toMatch(/user/i)
    expect(result.ok ? 0 : 1).toBe(1)
  })

  test('Test D — write rejection: verifier transaction context is genuinely read-only', async () => {
    const db = require('../db/models')
    const probeCode = `W01_RO_${Date.now()}`
    let rejected = null
    try {
      await verifier.withReadOnlyTransaction(db.sequelize, async (transaction) => {
        // Any write inside the verifier transaction must be rejected by Postgres.
        await db.sequelize.query(
          `INSERT INTO "tenant" (code, name, status, "createdAt", "updatedAt") VALUES (:code, :name, 'active', NOW(), NOW())`,
          { replacements: { code: probeCode, name: probeCode }, transaction }
        )
      })
    } catch (err) {
      rejected = err
    }
    expect(rejected).not.toBeNull()
    expect(String(rejected && rejected.message)).toMatch(/read[- ]?only/i)
    // Prove nothing was persisted (transaction rolled back / never applied).
    const found = await db.tenant.findOne({ where: { code: probeCode } })
    expect(found).toBeNull()
    // Read inside a read-only transaction still works (verifier can SELECT).
    await verifier.withReadOnlyTransaction(db.sequelize, async (transaction) => {
      const [rows] = await db.sequelize.query('SELECT 1 AS one', { transaction })
      expect(rows[0].one).toBe(1)
    })
  }, 30000)

  test('Test E — baseline handling: db/migration-baseline.txt semantics are honoured', () => {
    const manifest = verifier.readMigrationManifest()
    const files = verifier.discoverMigrationFiles()
    // Repository evidence: baseline lists snapshot-embodied migrations;
    // pending tail = files not in manifest (includes Nov auth/tenant/audit).
    expect(manifest.length).toBeGreaterThan(0)
    expect(files.length).toBeGreaterThan(manifest.length)
    const comparison = verifier.compareMigrationState({
      files,
      manifest,
      metaNames: [...files]
    })
    expect(comparison.manifestWithoutFile).toEqual([])
    expect(comparison.pending.length).toBe(files.length - manifest.length)
    for (const required of [
      '20261007000001-add-dr20-foundation-fields-to-audit-log.js',
      '20261008000001-create-auth-foundation.js',
      '20261009000001-create-authorization-context-session.js',
      '20261010000001-add-disabled-at-to-user.js',
      '20261011000001-add-reactivated-at-to-tenant-membership.js'
    ]) {
      expect(files).toContain(required)
      expect(comparison.pending).toContain(required)
    }
    // Baseline entries are provenance, not exemption: a missing baseline
    // migration in Meta must still fail.
    const baselineVictim = manifest[0]
    const missingBaseline = verifier.verifyFromState({
      ...completeState(),
      metaNames: completeState().metaNames.filter((n) => n !== baselineVictim)
    })
    expect(missingBaseline.ok).toBe(false)
    expect(missingBaseline.failures.join('\n')).toContain(baselineVictim)
    // A manifest entry with no migration file is a provenance error.
    const bogus = verifier.compareMigrationState({
      files,
      manifest: [...manifest, '99999999999999-does-not-exist.js'],
      metaNames: [...files]
    })
    expect(bogus.ok).toBe(false)
    expect(bogus.manifestWithoutFile).toContain('99999999999999-does-not-exist.js')
    // Duplicate manifest entries are rejected at read time (same rule as
    // scripts/validate-migration-chain.js).
    const tmp = path.join(__dirname, '..', 'scripts', '__w01_dup_probe__.txt')
    require('fs').writeFileSync(tmp, 'a.js\na.js\n')
    try {
      expect(() => verifier.readMigrationManifest(tmp)).toThrow(/duplicate/i)
    } finally {
      require('fs').unlinkSync(tmp)
    }
  })

  test('critical schema list covers November auth/tenant/audit baseline', () => {
    const state = completeState()
    // Tables required by the November baseline.
    for (const table of ['user', 'tenant', 'tenant_membership', 'store_assignment', 'authorization_context_session', 'auditLog', 'location']) {
      expect(state.schema[table]).toBeDefined()
    }
    expect([...state.schema['user']]).toContain('disabledAt')
    expect([...state.schema['tenant_membership']]).toContain('reactivatedAt')
    expect([...state.schema['location']]).toContain('tenantId')
    expect([...state.schema['authorization_context_session']]).toEqual(
      expect.arrayContaining(['sessionId', 'userId', 'activeTenantId', 'activeStoreId', 'version', 'expiresAt', 'revokedAt'])
    )
    for (const col of ['actorType', 'tenantId', 'result', 'requestId', 'reason', 'source', 'metadata']) {
      expect([...state.schema['auditLog']]).toContain(col)
    }
  })
})
