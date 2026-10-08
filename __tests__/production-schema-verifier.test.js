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

  // W-01.1: an approved disposition manifest is a required verifier input.
  function approvedDispositions(files, rows) {
    return {
      schemaVersion: 1,
      environment: 'production',
      evidenceCapturedAt: '2026-10-01T17:08:46Z',
      approvedBy: 'reviewer@example.test',
      approvedAt: '2026-10-02T00:00:00Z',
      migrations: rows || [
        { migration: files[0], disposition: 'ATTESTED_PRESENT', evidenceRef: 'fixture evidence' },
        { migration: files[1], disposition: 'EXCLUDED_UNSAFE', evidenceRef: 'fixture evidence' }
      ]
    }
  }

  function completeState() {
    const files = verifier.discoverMigrationFiles()
    const manifest = verifier.readMigrationManifest()
    return {
      files,
      manifest,
      metaNames: [...files],
      schema: verifier.completeTestSchema(),
      dispositions: approvedDispositions(files)
    }
  }

  test('Test A — pass: schema matching expected migration/critical-column state passes', () => {
    const state = completeState()
    const result = verifier.verifyFromState(state)
    expect(result.ok).toBe(true)
    expect(result.status).toBe('PASS')
    expect(result.exitCode).toBe(0)
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
    expect(result.status).toBe('FAIL')
    expect(result.exitCode).toBe(1)
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

  describe('W-01.1 disposition contract (PASS / FAIL / BLOCKED)', () => {
    const dispositions = require('../scripts/migration-dispositions')

    function withRows(state, rows) {
      return { ...state, dispositions: approvedDispositions(state.files, rows) }
    }

    test('dispositions are a required input (no silent skip of the manifest)', () => {
      const { dispositions: _omit, ...state } = completeState()
      expect(() => verifier.verifyFromState(state)).toThrow(/requires dispositions/)
    })

    test('BLOCKED: structurally sound with an open decision → exit 2, decision listed, never PASS', () => {
      const state = completeState()
      const result = verifier.verifyFromState(
        withRows(state, [
          { migration: state.files[0], disposition: 'ATTESTED_PRESENT', evidenceRef: 'e' },
          { migration: state.files[1], disposition: 'BLOCKED_DECISION', evidenceRef: 'e', decisionRef: 'D-05 test' }
        ])
      )
      expect(result.status).toBe('BLOCKED')
      expect(result.exitCode).toBe(2)
      expect(result.ok).toBe(false)
      expect(result.failures).toEqual([])
      expect(result.blocked).toEqual([{ migration: state.files[1], decisionRef: 'D-05 test' }])
    })

    test('FAIL dominates BLOCKED (a structural failure is never reported as BLOCKED)', () => {
      const state = completeState()
      const result = verifier.verifyFromState({
        ...withRows(state, [
          { migration: state.files[1], disposition: 'BLOCKED_DECISION', evidenceRef: 'e', decisionRef: 'D-05 test' }
        ]),
        metaNames: state.metaNames.filter((n) => n !== state.files[2])
      })
      expect(result.status).toBe('FAIL')
      expect(result.exitCode).toBe(1)
    })

    test('controlled apply pending → FAIL', () => {
      const state = completeState()
      const result = verifier.verifyFromState(
        withRows(state, [{ migration: state.files[0], disposition: 'CONTROLLED_APPLY_PENDING', evidenceRef: 'e' }])
      )
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/controlled apply still pending/)
    })

    test('controlled applied (with applyRef) is PASS-eligible', () => {
      const state = completeState()
      const result = verifier.verifyFromState(
        withRows(state, [{ migration: state.files[0], disposition: 'CONTROLLED_APPLIED', evidenceRef: 'e', applyRef: 'apply-record-1' }])
      )
      expect(result.status).toBe('PASS')
    })

    test('manifest row not recorded in SequelizeMeta → FAIL', () => {
      const state = completeState()
      const target = state.files[1]
      const result = verifier.verifyFromState({ ...state, metaNames: state.metaNames.filter((n) => n !== target) })
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/disposition manifest rows not recorded in SequelizeMeta \(1\)/)
    })

    test('unapproved manifest → FAIL (dispositions cannot be asserted without approval)', () => {
      const state = completeState()
      const result = verifier.verifyFromState({
        ...state,
        dispositions: { ...state.dispositions, approvedBy: null, approvedAt: null }
      })
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/not approved/)
    })

    test('invalid manifest (unknown migration) → FAIL', () => {
      const state = completeState()
      const result = verifier.verifyFromState(
        withRows(state, [{ migration: '20990101000000-not-a-file.js', disposition: 'ATTESTED_PRESENT', evidenceRef: 'e' }])
      )
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/unknown migration/)
    })

    test('malformed manifest JSON (read error) → FAIL', () => {
      const state = completeState()
      const result = verifier.verifyFromState({
        ...state,
        dispositions: null,
        dispositionErrors: ['disposition manifest is malformed JSON: Unexpected token']
      })
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/malformed JSON/)
    })

    test('orphan SequelizeMeta row → FAIL', () => {
      const state = completeState()
      const result = verifier.verifyFromState({ ...state, metaNames: [...state.metaNames, '29991231000000-orphan.js'] })
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/no migration file/)
    })

    test('duplicate SequelizeMeta row → FAIL', () => {
      const state = completeState()
      const metaNames = [state.metaNames[0], ...state.metaNames]
      const result = verifier.verifyFromState({ ...state, metaNames })
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/duplicate SequelizeMeta entries/)
    })

    test('SequelizeMeta ordering inconsistency → FAIL', () => {
      const state = completeState()
      const metaNames = [...state.metaNames]
      ;[metaNames[0], metaNames[1]] = [metaNames[1], metaNames[0]]
      const result = verifier.verifyFromState({ ...state, metaNames })
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/ordering/)
    })

    test('critical schema failure still FAILs with a valid manifest', () => {
      const state = completeState()
      const schema = { ...state.schema, auditLog: new Set(['id']) }
      const result = verifier.verifyFromState({ ...state, schema })
      expect(result.status).toBe('FAIL')
      expect(result.failures.join('\n')).toMatch(/auditLog/)
    })

    test('repository manifest against the W-02 production evidence (26 Meta rows) → FAIL, never PASS', () => {
      // Restore/pre-stamp semantics: a ledger without the stamped dispositions
      // must not silently pass. 26 = production SequelizeMeta size recorded by W-02.
      const files = verifier.discoverMigrationFiles()
      const { manifest } = dispositions.readDispositionManifest()
      // The repository manifest itself has no pending rows left (all three
      // controlled applies verified); force one synthetic pending row so the
      // pending gate stays covered while the unstamped-ledger FAIL is probed.
      const withPending = {
        ...manifest,
        migrations: manifest.migrations.map((r) =>
          r.migration === '20260906000004-split-bill-hardening.js'
            ? { migration: r.migration, disposition: 'CONTROLLED_APPLY_PENDING', evidenceRef: r.evidenceRef }
            : r
        )
      }
      const prodMeta = files.filter((f) => f < '20260601000000' || /^20261008|^20261009|^20261010/.test(f))
      expect(prodMeta).toHaveLength(26)
      const result = verifier.verifyFromState({
        files,
        manifest: verifier.readMigrationManifest(),
        metaNames: prodMeta,
        schema: verifier.completeTestSchema(),
        dispositions: withPending
      })
      expect(result.status).toBe('FAIL')
      const joined = result.failures.join('\n')
      // The repository manifest is approved; it still FAILs because nothing is
      // stamped and the controlled applies are pending (approval is only the
      // first step: approve → stamp → controlled apply → verify → runner).
      expect(joined).not.toMatch(/not approved/)
      expect(joined).toMatch(/disposition manifest rows not recorded in SequelizeMeta \(197\)/)
      expect(joined).toMatch(/controlled apply still pending \(1\)/)
    })

    test('repository manifest, approved + fully stamped + controlled applies done → PASS (every E6 decision recorded: D-05, DR-21, DR-06)', () => {
      const files = verifier.discoverMigrationFiles()
      const { manifest } = dispositions.readDispositionManifest()
      const simulated = {
        ...manifest,
        approvedBy: 'reviewer@example.test',
        approvedAt: '2026-10-02T00:00:00Z',
        migrations: manifest.migrations.map((r) =>
          r.disposition === 'CONTROLLED_APPLY_PENDING'
            ? { ...r, disposition: 'CONTROLLED_APPLIED', applyRef: 'simulated apply record' }
            : r
        )
      }
      const result = verifier.verifyFromState({
        files,
        manifest: verifier.readMigrationManifest(),
        metaNames: [...files],
        schema: verifier.completeTestSchema(),
        dispositions: simulated
      })
      // No BLOCKED_DECISION row remains in the repository manifest; the
      // BLOCKED contract itself is covered by the synthetic-fixture tests in
      // the disposition-contract block above and in formatReport below.
      expect(simulated.migrations.filter((r) => r.disposition === 'BLOCKED_DECISION')).toEqual([])
      expect(result.failures).toEqual([])
      expect(result.blocked).toEqual([])
      expect(result.status).toBe('PASS')
      expect(result.exitCode).toBe(0)
    })

    test('end to end against the TEST database (read-only): repository manifest → FAIL, exit 1, never PASS', async () => {
      const db = require('../db/models')
      const [{ name }] = await db.sequelize.query('SELECT current_database() AS name', { type: db.sequelize.QueryTypes.SELECT })
      expect(name).toMatch(/_test$/)
      const result = await verifier.verifyProductionSchema(db.sequelize)
      expect(result.status).toBe('FAIL')
      expect(result.exitCode).toBe(1)
      // Approved manifest: the failure is the missing ledger, not approval.
      expect(result.failures.join('\n')).not.toMatch(/not approved/)
      expect(result.failures.join('\n')).toMatch(/not recorded in SequelizeMeta/)
    }, 30000)

    test('report wording: recorded state only — never claims the population was executed/applied', () => {
      const state = completeState()
      const pass = verifier.formatReport(verifier.verifyFromState(state))
      const text = [...pass.out, ...pass.err].join('\n')
      expect(pass.exitCode).toBe(0)
      expect(text).toMatch(/recorded in SequelizeMeta/)
      expect(text).toMatch(/execution provenance not asserted for pre-W-01\.1 rows/)
      expect(text).not.toMatch(/\bexecuted\b/i)
      expect(text).not.toMatch(/\ball (?:\d+ )?migrations (?:were |have been )?(?:applied|executed)/i)

      const blocked = verifier.formatReport(
        verifier.verifyFromState(
          withRows(state, [{ migration: state.files[0], disposition: 'BLOCKED_DECISION', evidenceRef: 'e', decisionRef: 'D-08 test' }])
        )
      )
      expect(blocked.exitCode).toBe(2)
      expect(blocked.err.join('\n')).toMatch(/BLOCKED[\s\S]*D-08 test/)
    })
  })
})
