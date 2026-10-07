# Migration disposition manifests (W-01.1 / W-02R.4)

## What SequelizeMeta means (D-02, Model D)

`SequelizeMeta` is the migration runner's **do-not-execute ledger**: a
migration name recorded there must never be executed again by
`sequelize-cli` against that database.

A recorded row does **not** assert that the migration was historically
executed. Rows recorded before W-01.1 have no verified execution provenance.

## What a manifest is

`production.json` is the reviewed, version-controlled record of **why**
production migrations are recorded in `SequelizeMeta` without being executed
by the runner. Migrations that are meant to run normally (W-02R.3R class E2)
are deliberately **not** listed.

This is not `db/migration-baseline.txt`. The baseline is dev-snapshot
provenance for the CI chain validator. It is never a production exemption
list.

## Shape (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "environment": "production",
  "evidenceCapturedAt": "<ISO-8601 UTC>",
  "approvedBy": null,
  "approvedAt": null,
  "migrations": [
    { "migration": "<exact filename>", "disposition": "<state>", "evidenceRef": "<evidence>" }
  ]
}
```

- `migrations` holds exact repository filenames, sorted, each listed once.
- Unknown fields are invalid.
- The manifest is approved **as a whole**: `approvedBy` and `approvedAt` are
  either both `null` (pending review) or both set. There are no per-row
  approvals.
- An unapproved manifest:
  - can be dry-run;
  - can never be stamped;
  - makes the verifier FAIL;
  - makes the preflight refuse.

## Dispositions

| State | Meaning | Conditional fields | Verifier |
|---|---|---|---|
| `ATTESTED_PRESENT` | Effect embodied, or its missing part is superseded. Never run. | — | pass-eligible |
| `EXCLUDED_UNSAFE` | Effect embodied, but replay is unsafe. Never run; never remove from the ledger. | — | pass-eligible |
| `EXCLUDED_SUPERSEDED` | Moot or superseded. Never run. | `supersededBy` (a later repository migration) | pass-eligible |
| `CONTROLLED_APPLY_PENDING` | File never runs; a reviewed controlled operation is still required. | `decisionRef` when decision-dependent | **FAIL** |
| `CONTROLLED_APPLIED` | The controlled operation was performed and independently verified. | `applyRef` (+ optional `decisionRef`) | pass-eligible |
| `BLOCKED_DECISION` | A business decision is still required. | `decisionRef` | **BLOCKED** |
| `EXCLUDED_BY_DECISION` | A recorded decision says never apply. | `decisionRef` | pass-eligible |

Field rules:
- `evidenceRef` is required on every row.
- `decisionRef` starts with a decision id (`D-nn` or `DR-nn`).

## Lifecycle

1. **Review.** A change to `production.json` goes through a PR. Approval sets
   `approvedBy` and `approvedAt`. Before approval, the evidence bundle cited
   by `evidenceRef` must be retained somewhere durable.
2. **Stamp.** This is a separately authorized production action:
   ```
   node scripts/apply-migration-dispositions.js --target=production
   node scripts/apply-migration-dispositions.js --target=production --apply \
     --authorize-manifest-sha256=$(shasum -a 256 db/migration-dispositions/production.json | cut -d' ' -f1)
   ```
   The first command is a dry run (read-only); the second writes. Stamping
   happens in one transaction, inserts only missing names, and never changes
   or removes existing rows.
3. **Run migrations.** `npm run migrate` runs the preflight first and starts
   `sequelize-cli db:migrate` only when every disposition is stamped and none
   is blocked or pending. Never run `sequelize-cli db:migrate` against
   production before stamping is complete. E2 (migrations not listed in the
   manifest) runs in separately approved bounded batches,
   `npm run migrate -- --env production --batch B1|B2|B3`. See
   `scripts/migration-batches.js` and
   `docs/superpowers/evidence/d08-e2-batch-contract-record.md`.
4. **Controlled apply.** For each `CONTROLLED_APPLY_PENDING` row, a reviewed
   operation applies the missing effect. Once it is verified, the row becomes
   `CONTROLLED_APPLIED` with an `applyRef`. The migration file itself is never
   executed.
5. **Decisions.** Each `BLOCKED_DECISION` becomes `EXCLUDED_BY_DECISION`, or
   goes through the controlled-apply path once the owner decides. Rows are
   never removed from `SequelizeMeta` to "re-enable" a migration.

## Restore

A production backup taken **before** stamping restores a ledger without the
dispositions. The verifier then FAILs ("manifest rows not recorded") and the
preflight refuses to run migrations. Re-run the stamper (it is idempotent)
before any migration is executed.

## Staging rehearsal manifest (W-02R.4)

`staging.json` is the rehearsal-only counterpart of `production.json`: same
schema (`schemaVersion: 1`), same validation rules, same 197-row rehearsal
contract — but `"environment": "staging"`, its own whole-file approval, and
its own SHA authorization. It never authorizes production and production
approval never authorizes staging (the environment-mismatch check fails
either crossover closed).

- Staging reads only `STAGING_DB_*` variables, never `POSTGRES_*`.
- Staging stamping uses the same INSERT-only transactional core:
  `node scripts/apply-migration-dispositions.js --target=staging [--apply
  --authorize-manifest-sha256=<sha256 of staging.json>]`.
- The ephemeral rehearsal harness (`scripts/rehearse-staging.js`, see
  `RELEASING.md`) drives the full lifecycle — disposable database, drift
  fixture, stamping, controlled applies, E2 runner, verification, evidence,
  teardown — and never touches production.
- A successful rehearsal does NOT approve `production.json`, stamp
  production, or authorize any production migration.
