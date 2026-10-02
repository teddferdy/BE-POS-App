# Release Runbook — BE-POS-App

This repo does **not** deploy via GitHub Actions. Disabling that no-op `deploy`
job removed a fake release gate; the real release flow is the Vercel Git
integration below (`vercel.json` routes everything to the `@vercel/node`
serverless entry `api/index.js`).

## Production schema verification gate (W-01 / W-01.1 — mandatory)

Every production release MUST pass the read-only production-schema verifier
before it proceeds:

1. Run the verifier against the target production database:
   `npm run check:production-schema`
   (connects via the production configuration in `.env.production`; see
   `scripts/check-production-schema.js`).
2. Outcomes:
   - **PASS (exit `0`)**: every repository migration is recorded in
     `SequelizeMeta`; the approved disposition manifest is valid and fully
     recorded; no controlled apply is pending; no business decision is open;
     the November auth/tenant/audit critical schema is present.
   - **FAIL (exit `1`)**: any structural or schema problem. This includes an
     invalid or unapproved manifest, a manifest row not recorded, a
     repository migration not recorded, orphan/duplicate/misordered
     `SequelizeMeta` rows, a `CONTROLLED_APPLY_PENDING` row, or missing
     critical schema.
   - **BLOCKED (exit `2`)**: structurally sound, but at least one
     `BLOCKED_DECISION` remains. The open decision references are listed.
     BLOCKED is not PASS.
   All reads run inside a single `SET TRANSACTION READ ONLY` transaction, and
   `db/migration-baseline.txt` is still honoured as provenance.
3. If the verifier exits non-zero (FAIL **or** BLOCKED), the release STOPS.
   Do not merge, do not deploy, and do not retry with different flags.
4. The verifier NEVER stamps dispositions and NEVER applies migrations.
   **VERIFY** (this gate) is strictly read-only. **STAMP DISPOSITIONS** and
   **APPLY MIGRATIONS** are separate, explicitly authorized operational
   actions.
5. After any authorized production change, rerun the verifier and retain its
   output (stdout/stderr + exit status) as release evidence.

### What the verifier asserts

`SequelizeMeta` is the migration runner's **do-not-execute ledger** (D-02,
Model D): a recorded name must never be executed again by `sequelize-cli`.
A recorded row does **not** assert that the migration was executed; rows
recorded before W-01.1 have no verified execution provenance. The verifier
reports **recorded** state only, for example:

```
235/235 recorded in SequelizeMeta: runner-recorded N (execution provenance not asserted for pre-W-01.1 rows), attested X, excluded Y, controlled-applied Z, controlled-pending P, blocked B
```

It never reports that "all migrations were executed/applied".

### Disposition manifest

`db/migration-dispositions/production.json` is the reviewed record of **why**
production migrations are recorded without being executed by the runner. The
vocabulary and field rules are in `db/migration-dispositions/README.md`.

- It is approved as a whole (`approvedBy`/`approvedAt`). An unapproved
  manifest can only be dry-run: the verifier FAILs and the preflight refuses.
- Migrations meant to run normally are not listed.
- It is **not** `db/migration-baseline.txt`, which stays dev-snapshot
  provenance for the CI chain validator.

### Production migration order (each step separately authorized)

1. **Approve** the manifest (PR review sets `approvedBy`/`approvedAt`; the
   evidence it cites is retained durably).
2. **Stamp** dispositions. Dry run first:
   `node scripts/apply-migration-dispositions.js --target=production`
   Then apply:
   `node scripts/apply-migration-dispositions.js --target=production --apply --authorize-manifest-sha256=<sha256 of the approved manifest file>`
   - The stamp is one transaction that only inserts missing names.
   - It verifies the result before commit, and refuses an unapproved,
     malformed or orphaned manifest.
   - The sha256 binds the authorization to the reviewed file content. It is
     not a credential.
3. **Controlled applies.** Each `CONTROLLED_APPLY_PENDING` effect is applied
   by a reviewed operation, verified, and recorded as `CONTROLLED_APPLIED`
   with an `applyRef`. The migration file itself is never executed.
4. **Decisions.** Each `BLOCKED_DECISION` row needs the owner decision named
   in its `decisionRef`, recorded as `EXCLUDED_BY_DECISION` or carried out
   through the controlled-apply path. While any remain, the verifier is
   BLOCKED and G-02 cannot pass.
5. **Run migrations** only with `npm run migrate`. It runs
   `scripts/check-migration-preflight.js` first (fail closed: manifest valid
   and approved, every disposition recorded, nothing blocked or pending, no
   orphan rows) and only then starts the pinned `sequelize-cli db:migrate`
   for the same `--env`. Flags that could retarget the runner are refused.
6. **Verify**: `npm run check:production-schema` must PASS.

**Never run `sequelize-cli db:migrate` (or `npx sequelize-cli`) directly
against production before stamping is complete.** Unstamped migrations are
pending to the runner and would be replayed. Never delete a `SequelizeMeta`
row to "re-enable" a migration.

### Restore

A production backup taken before stamping restores a ledger without the
dispositions. The verifier then FAILs and the preflight refuses, so nothing
silently passes. Re-run the stamper (it is idempotent) before any migration
runs, then re-verify.

## Release flow

1. **Push / open a PR** against `master`. CI (`.github/workflows/ci.yml`)
   runs the full Jest suite against a real Postgres (`postgres:16` service)
   plus ESLint.
2. **Wait for CI checks to PASS.** Nothing goes out otherwise.
3. **Merge the PR to `master`.** The Vercel Git integration detects the push
   and builds + deploys the serverless function automatically (production
   branch `master`).
4. **Post-deploy health check** (production):
   - `curl -I https://api-bisa-nota.vercel.app` → expect an HTTP response
     (non-5xx) and the `no-cache, no-store, must-revalidate` headers.
5. **Smoke test** the critical flow from the FE: log in → cashier order →
   Kitchen Display → payment settlement, confirming writes through this API.

## Prerequisites on the platform

- Production env vars set in the Vercel project: `DATABASE_URL`,
  `JWT_SECRET_KEY`, `JWT_EXPIRED_IN`, and the optional `REDIS_*` /
  `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
  values (see `.env.example` for the full variable list).
- Only merge to `master` after CI is green; rollback is available from the
  Vercel dashboard.