# Production Hardening Program — POS-APP (Aug 2026)

Program-level design for taking the POS stack to production for paying clients
across small, medium, and high scale. Covers three subprojects: BE-POS-App
(Node/Express API), FE-POS-App (React/Vite staff SPA), BISA-MAKAN-APP
(React/Vite customer app).

## Status

- Decisions locked: see "Decisions".
- Host provider: **DEFERRED by owner** (not yet created; design is
  provider-agnostic — Docker image + GHCR registry + compose. Provisioning is
  a P1 sub-step that must be resolved before live cutover.)

## Decisions

| Decision | Choice | Note |
|---|---|---|
| Backend runtime | Containerized, always-on (Docker) | Leaves Vercel serverless |
| Tenancy / scale meaning | Single multi-tenant deployment; scale = total stores/transactions on a shared stack | storeId + RBAC isolation already in place |
| Operations owner | We operate the API host; clients get URLs + credentials | |
| DB | Managed Postgres (Neon, existing) | Pool/migrations stay Sequelize |
| File/object storage | S3-compatible object store (R2/S3) | @aws-sdk dep already exists |
| Token strategy | Access + refresh; refresh in httpOnly cookie | Short access (15–30m), refresh ~7d |
| Redis placement | Compose service `redis:7-alpine` for dev/small; managed `REDIS_URL` (Upstash) for prod medium→high | Not embedded in API image |
| Observability sink (default) | Structured JSON to stdout + self-hosted Loki (compose) | Grafana Cloud optional alternative |
| Deploy pipeline | GitHub Actions → GHCR → host health-gated compose up | Staging env + rollback |

## Approach

**Sequenced hardening program (A):** order by risk so the stack is
production-viable at every milestone. Phases: P0 Security → P1 Containerized
Runtime → P2 Observability → P3 Scale Architecture → P4 Resilience &
Operations.

Each phase ends with: green tests + a deployment + a smoke checklist. Each
phase is converted to its own implementation plan; P0 ships first.

## Current-state facts (audit, Aug 2026)

- BE: Express 4 + Sequelize 6 + pg, socket.io, helmet/compression/cors
  present; 67 route modules, ~210 endpoints, 182 migrations, Jest tests.
- Supply gap: BE is deployed as a Vercel serverless function where Socket.IO,
  schedulers (backup/expense/shift-swap), graceful shutdown, and `pg_dump`
  are silently disabled via `if (!process.env.VERCEL)` guards.
- Secrets exposure: live prod credentials in `.env.production`/`.env.local` on
  disk; committed dev DB password fallback `teddyferdian98` in 8 tracked
  scripts; committed default seed passwords (`superadmin123`, `admin123`, …).
- Rate limiting neutered: global limiter skips all authenticated requests;
  `/auth/register` public and unlimited.
- Socket.IO unauth; `whatsapp-server.js` has no auth/rate-limit and writes
  user-controlled filenames; invoice PDFs exposed via `express.static('public')`.
- FE: JWT in JS-readable cookie (no Secure/SameSite/httpOnly); DSN + fake
  Sentry identity hardcoded; no CSP; cross-origin SW cache mostly inert.
- BISA: `.env` (localhost fallback) committed; env var name mismatch in
  README; no tests/PWA/Sentry; token interceptor reads a key nothing writes.

See the full audit for exact file:line references; the implementation plans
will carry the concrete touch points.

---

## P0 — Security Hardening (highest priority, ships first)

Order within P0 is already risk-ranked; do not reorder.

### P0.1 Credential rotation and purge
1. Rotate every exposed secret before P0 ships:
   Neon prod PG password + connection string, `JWT_SECRET_KEY`, Cloudinary
   secret, Vercel deploy/OIDC token used by BE.
2. New values live only in the runner's secret store (CI variables + host
   secret-manager/`.env` not committed); never in git or tracked scripts.
3. Delete on-disk `BE-POS-App/.env.production` and `.env.local`.
4. Add `BE-POS-App/.env.example` (gitignore already reserves `!.env.example`).
5. Remove the `teddyferdian98` fallback from the 8 tracked scripts; make them
   fail fast when env config is missing (error, not silent default).
6. Remove committed default passwords from seeders
   (`db/seeders/20240515000001-super-admin-user.js`,
   `db/seeders/20260601122557-create-admin-and-user-accounts.js`). Seeders
   become dev-only samples; real bootstrap creates the initial admin from
   required env with a forced strong password.

### P0.2 Auth hardening
- JWT gains `iss`/`aud` claims and per-environment secret; asymmetric option
  (RS256) left as a documented follow-up, not required for P0.
- New token flow (Decisions): short-lived access token (15–30 min) returned
  in the login response body; refresh token (≈7d) set as `httpOnly`,
  `Secure`, `SameSite=Lax`, path-scoped cookie. Refresh rotates on use;
  reused/expired refresh → logout + re-login. `/auth/refresh` endpoint added.
- FE auth bootstrap: on load, if no access token, call `/auth/refresh`; on
  401 → refresh → retry once → else `auth:session-expired`.
- CSRF: `SameSite=Lax` + an origin check middleware on state-changing routes
  (reject cross-origin POST/PUT/DELETE with an `Origin` header that isn't the
  allowlisted app origin). Documented limit: request forgery risk reduced;
  review again if refresh moves off path-scoped.
- Password reset: store the token as a hash (not plaintext) with TTL and
  invalidation after use; keep the short 15-min window.
- Login now requires an active account: the handler no longer force-sets
  `status: active` on every login, so a disabled/blocked account stays
  disabled.

### P0.3 Socket.IO + WhatsApp auth
- `io.use()` JWT middleware validates the access token and store membership
  before a client can join `store-{id}` / `kitchen-{id}` rooms; leave on an
  explicit disconnect on auth failure. Store-scope checks mirror
  `utils/storeValidation.js`.
- `whatsapp-server.js`: require auth (admin token or delegated JWT), rate
  limit, sanitize `fileName` via `path.basename()` + allowlist, don't bind a
  public route by default (opt-in `WA_PUBLIC=1` for dev only).

### P0.4 Close leaky surfaces
- Stop serving invoice PDFs via `express.static('public')`; generate to
  object storage (or `/tmp` in dev) and serve only through an
  authenticated, store-scoped download endpoint. Keep only intended public
  assets static.
- Central error handler: log full stack server-side; return a generic
  message to clients (do not echo `err.message`).

### P0.5 Frontend hardening (both apps)
- `token` cookie → `Secure`, `SameSite`; access token sits in memory
  (zustand) attached as `Authorization: Bearer`; refresh cookie httpOnly.
- CSP + security headers (`X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, frameguard) delivered at the Vercel edge (vercel.json)
  for FE and BISA.
- Sentry DSN via env (not hardcoded); remove fabricated user identity; tag
  real user when logged in.
- BISA: `VITE_API_BASE_URL` set in Vercel, README corrected, `.env` untracked,
  no silent localhost fallback in production builds (build fails on missing
  env instead).

### P0.6 Tests
Add coverage: socket auth, whatsapp-server auth + sanitization, invoice
download authorization (store-scoped), rate limit on `/auth/register`,
cookie flags on `/auth/login` + `/auth/refresh` responses. Existing Jest +
supertest setup and CI (`.github/workflows/ci.yml`) carry them.

### P0 success
No secrets in git/disk; default passwords gone; sockets/WA auth required;
invoice not publicly listable; register rate-limited; cookies httpOnly
refresh + Secure access; CSP active on both frontends; new tests green.

---

## P1 — Containerized Runtime

Provider-agnostic core; host provisioning is deferred and must be decided
before cutover.

### P1.1 Image & compose
- Multi-stage `Dockerfile` on `node:20-slim`, non-root user, `HEALTHCHECK`
  hitting `/healthz`; `.dockerignore` excludes node_modules/secrets.
- Release `docker-compose.yml`: `api` service (+ `redis` in P3). Dev
  `docker-compose.dev.yml` with optional local Postgres for parity.
- Migrations are NOT auto-run on boot; run explicitly in the deploy flow
  (migrate → health → traffic), with a documented undo/rollback path.
- Remove `if (!process.env.VERCEL)` guard behavior: Socket.IO, schedulers,
  graceful shutdown, and `pg_dump` run as first-class code paths in the
  container. Keep a startup env flag if a feature must be toggled.

### P1.2 Deploy pipeline
- GitHub Actions: lint+test → build image → push to GHCR (tag `sha`) →
  on host: `docker compose pull && up -d` behind a health gate (run
  migrations first, wait `/healthz`, then cut over). Rollback = redeploy
  previous tag; document the exact commands.
- Staging environment mirroring prod compose.

### P1.3 Cutover
- When host exists (decision deferred): provision (SSH, non-root deploy
  user, firewall, base patching) coming from the P1 plan's provider option;
  point FE/BISA `VITE_BASE_URL` to the container API origin; update CORS
  allowlist `api/utils/corsOptions.js`; retire the BE Vercel deployment.
- Risk note: full cutover is blocked until the provider is chosen.

### P1 success
This is the effective production runtime: BE on always-on containers, sockets
+ schedulers + backups functional, CI/CD auto-deploy with health gate,
migrate-before-traffic, rollback documented.

---

## P2 — Observability

- Structured JSON request logs (already present in
  `api/index.js:147-166`) streamed to a sink: default self-hosted Loki in
  compose (small/medium); Grafana Cloud optional. No PII in logs.
- Sentry: env-driven DSN, per-env release/trace, no fabricated identity.
- `/healthz` (liveness) and `/readyz` (DB pool + Redis reachability).
- `/metrics` with prom-client: request rate/latency, error rate, queue depth,
  pool health.
- Alerting: uptime, error spike, queue backlog, host disk — one channel
  (email/Slack/webhook).

### P2 success
Ops can see request/error/latency at a glance, get alerts, and health-check a
deployment — locally and in prod.

---

## P3 — Scale Architecture

- Redis: compose service (dev/small) / managed `REDIS_URL` (prod
  medium→high). Uses: cache for low-churn reads, rate-limit store (replaces
  in-memory), job queue (BullMQ-style on Redis streams).
- Worker container: move schedulers, backup, WhatsApp, PDF/thermal offload
  out of the API image so heavy deps (puppeteer, whatsapp-web.js) don't
  bloat it. API stays stateless.
- DB: tune Sequelize pool per replica; index audit on hot paths; keyset
  pagination instead of OFFSET on list endpoints; connection budget via
  pgbouncer only if a measurement justifies it.
- Multi-replica readiness: with API stateless + shared Redis + managed PG,
  "high" tier = 2+ replicas behind a load balancer.
- Load test: extend the existing artillery `load-test.yaml` into
  small/medium/high tiers (RPS, p95 latency, CPU targets) and record a
  baseline.

### P3 success
Identified hot paths measured; Redis + worker split done; API is stateless
and can run N replicas; load-test baselines recorded.

---

## P4 — Resilience & Operations

- Encrypted offsite backups via `pg_dump` (worker scheduler) to object
  storage with retention; not the local `backups/` folder.
- Restore drill performed on a schedule and documented (playbook), not just
  a script.
- Staging + rollback flow from P1.2 maintained.
- Runbook: boot/start, health checks, common incidents (DB pool, Redis,
  queue backlog, WhatsApp session), rollback, on-call basics.
- Tier matrix (sizing table): small / medium / high — vCPU, RAM, replicas,
  Redis mode, backup cadence, expected RPS envelope.
- Dependency/patch policy: Dependabot for npm + base image, scheduled patch
  window, pinned lockfile.

### P4 success
Data can be restored from offsite within the target RTO (state the RTO in
the tier matrix), incidents have a written playbook, and upgrades are
routine.

---

## Annex A — Report surfaces & Excel-template ↔ form-schema alignment

Owner requirement: document which pages produce **laporan** (FE and BE), and
make every **Download Template** column align with the matching **Add/Edit
form schema** so a user can fill the template from what the form shows (and
bulk-import round-trips without silent data loss).

### A1. Report / export / print surfaces (current state)

| Page | FE file | Trigger | Output | BE endpoint |
|---|---|---|---|---|
| Invoice | `page/invoice/InvoicePage.jsx` | Cetak / Print | 58mm print + server PDF | `/pos` print-invoice |
| X/Z Report | `page/cash-register/XZReport.jsx` | Cetak X / Cetak Z | 58mm print (client) | `/pos` reports (X/Z) |
| Sales Report | `page/report/SalesReportPage.jsx` | Export | client xlsx | `GET /report/sales-summary` |
| Best Selling | `page/report/BestSellingReportPage.jsx` | Export | client xlsx | `GET /report/best-seller` |
| Advanced Reporting | `page/advanced-reporting/AdvancedReporting.jsx` | Export (sales tab) | client xlsx | `GET /reports/*` |
| Daily / Cash Flow / Profit per Product | `page/report/{DailyReport,CashFlowReport,ProfitPerProduct}.jsx` | none (view-only) | — | `GET /report/daily\|cash-flow\|profit-per-product` |
| Master Data Export | `page/backup/BackupPage.jsx` | Export master data | server xlsx multi-sheet | `GET /export/master-data` |
| Goods Receipt | `page/goods-receipt/GoodsReceiptList.jsx` / `DetailGoodsReceipt.jsx` | Export / Cetak | client xlsx / print | goods-receipt queries |
| Goods Request | `page/goods-request/GoodsRequestList.jsx` | Export | client xlsx | goods-request queries |
| Purchase Order | `page/purchase-order/DetailPurchaseOrder.jsx` | Export Excel / PDF | xlsx + jsPDF | `GET /purchase-order/get-by-id/:id` |

No export/print found: AccountingPage (ledger CRUD), supplier-performance,
audit-log, stock-history, sales/purchase return lists, dashboards.

### A2. Excel template ↔ form schema alignment (policy)

For every entity with a bulk import flow: the template headers MUST map to
real Add/Edit form fields; every required form field is either a template
column or optional-with-default on import; the import parser MUST
header-validate (pattern used by department/position/ingredient/stock-opname);
no silent drop of a template column; template and download-data headers stay
consistent. Each flow must expose all four triggers in the UI: download
template, download data, upload Excel, and (for list pages) the import modal.

### A3. Known alignment gaps (to fix within the program)

1. **Discount (HIGH):** BE import/export + FE services exist but
   `DiscountList.jsx` has no template/upload/download UI at all; template
   only covers the classic subset vs multi-promo form (bogo/bundling/
   happyHour/category).
2. **Purchase Order (HIGH):** `/purchase-order/template` service exists but
   no button; import creates one PO per row, items are `ingredientName` only
   (`product: null`), and drops dates/payment/tenor/discount/PIC.
3. **Advanced Reporting (MEDIUM):** `period` selector (Harian/Mingguan/
   Bulanan) not forwarded to `/reports/*` queries.
4. **Type Payment (MEDIUM):** template `Description` never imported;
   template vs download-data headers differ.
5. **Category (MEDIUM):** positional import with no header validation;
   parentId/color/sortOrder/image/icon form-only.
6. **Tax config (LOW):** template vocabulary PPN/PPh/Non-Pajak remapped to
   `ppn/other/service_charge` diverging from form `type` values.
7. **Product (LOW):** legacy 7-col `exportProduct` dead code; form-only
   brand/isAvailable/variant/modifier uncovered.
8. **Stock Opname (LOW):** one route serves template & export with differing
   filenames; client COLUMN_MAP (9 cols) narrower than the 12-header
   template.

Gap fixes land with P1 (import flows reshaped while moving runtime) and P3
(report/query work); P0 does not carry feature work. Each fix includes a
round-trip test: template → parse → DB fields identical to form submit.

---

## Tier matrix (to be finalized in P1/P4 plans)

| Tier | API | Redis | Backup cadence | Envelope |
|---|---|---|---|---|
| Small | 1 replica, 1 vCPU/1–2 GB | compose | daily | few stores, low RPS |
| Medium | 1–2 replicas, 2–4 GB | managed REDIS_URL | daily + retained | dozens of stores |
| High | 2+ replicas behind LB | managed REDIS_URL | hourly + daily retained | many stores, high RPS |

RTO/RPO targets: documented in P4 (default RPO ≤ 24 h hourly+; RTO ≤ 1 h).

## Testing strategy

- Per phase: Jest/supertest additions listed in the phase; FE Jest suites
  extended for auth bootstrap/refresh; CI runs all.
- Deploy health-gate checks `/healthz` + `/readyz`; smoke checklist includes
  login, socket connect, scheduler tick, backup run, invoice download.
- Load tests run in P3 and re-run on infra changes.

## Open items / deferred

| Item | Resolution |
|---|---|
| Host provider | DEFERRED — must be decided before P1 cutover (P1 plan will branch VPS vs PaaS provisioning) |
| Refresh lifetime / CSRF depth | Defaults set above; validate in implementation |
| Observability sink | Default self-hosted Loki; Grafana Cloud optional |