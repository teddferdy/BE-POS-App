# Release Runbook — BE-POS-App

This repo does **not** deploy via GitHub Actions. Disabling that no-op `deploy`
job removed a fake release gate; the real release flow is the Vercel Git
integration below (`vercel.json` routes everything to the `@vercel/node`
serverless entry `api/index.js`).

## Production schema verification gate (W-01 — mandatory)

Every production release MUST pass the read-only production-schema verifier
before it proceeds:

1. Run the verifier against the target production database:
   `npm run check:production-schema`
   (connects via the production configuration in `.env.production`; see
   `scripts/check-production-schema.js`).
2. The verifier MUST pass (exit `0`). It checks repository migration files
   against `SequelizeMeta`, honours `db/migration-baseline.txt`, and verifies
   the November auth/tenant/audit critical schema — all inside a single
   `SET TRANSACTION READ ONLY` transaction.
3. If the verifier fails (non-zero exit), the release STOPS. Do not merge,
   do not deploy, and do not retry with different flags.
4. The verifier NEVER applies migrations. **VERIFY** (this gate) is strictly
   read-only; **APPLY MIGRATIONS** (`sequelize-cli db:migrate` against
   production) remains an explicitly authorized operational action and is
   never performed silently by the verifier.
5. After any owner-approved production migration, rerun the verifier and
   confirm it passes before continuing the release.
6. Retain the verifier output (stdout/stderr + exit status) as release
   evidence.

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