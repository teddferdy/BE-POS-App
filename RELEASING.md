# Release Runbook — BE-POS-App

This repo does **not** deploy via GitHub Actions. Disabling that no-op `deploy`
job removed a fake release gate; the real release flow is the Vercel Git
integration below (`vercel.json` routes everything to the `@vercel/node`
serverless entry `api/index.js`).

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