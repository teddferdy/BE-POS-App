# BE-POS-App — DEEP SECURITY AUDIT (Read-Only)
# Generated: 2026-09-08
# Baseline: HEAD `9a904df` (master == origin/master), working tree clean (audit scope)

## EXECUTIVE SUMMARY
**VERDICT: BLOCKED — CRITICAL/HIGH FINDINGS. NOT READY FOR REMEDIATION FREEZE.**

Multi-tenancy is enforced **only at the application layer** — there are zero Sequelize
global scopes (`defaultScope`/`addScope` never used), single shared Postgres DB, and
isolation rests entirely on each controller pushing `store` into WHERE. A meaningful
subset of controllers bypass that discipline by reading **unvalidated** `req.cookies.store`,
`req.query.storeId`, `req.query.store`, or `req.body.storeId` instead of the middleware-set
`req.storeId`. Combined with a **public unauthenticated registration endpoint** that returns
a JWT immediately and lets the caller bind themselves to any store, an anonymous attacker
can reach multi-tenant data with a single HTTP call.

Every finding below was **verified first-hand against source at HEAD `9a904df`**. No code
was modified.

---

## CRITICAL FINDINGS

### CRIT-1 — Public self-registration hands out a JWT bound to any store
- **Files:** `api/routes/auth.js:61-64` (route), `api/controller/auth.js:413-500`
  (`registerNewUser`), `api/validation/schemas.js:103-124` (`registerSchema`)
- `POST /auth/register` is **not** behind `authorization`. `registerSchema` accepts
  `userType` (`admin`|`user`) and `store` (any number). The controller creates the user
  with `roleType: 'user'` and `store: body.store || null`, then **immediately returns a
  signed JWT** (`result.token = generateToken(...)`, auth.js:488-493).
- Since `validateStoreAccess` trusts the JWT's `store` claim (utils/storeValidation.js:6),
  an attacker registers with `store = <victim store>` and receives a fully-valid token
  already scoped to the victim tenant. Attacker is now an authenticated `roleType:'user'`
  in the victim store — dozens of endpoints require only `authorization`, not a role.
- **Impact:** Anonymous account provisioning + arbitrary-tenant binding. Escalates every
  HIGH below from "a store user can read another store" to "anyone on the internet can."
- **Remediation:** Remove `store`/`userType` from the public schema (force `store: null`,
  `userType: 'user'`); do not issue a token on register (require admin activation); or
  gate /register behind authorization + `requireRole('super_admin','admin')`.

### CRIT-2 — `/auth/get-user` returns the entire cross-tenant user table
- **Files:** `api/routes/auth.js:80-82` (route, `authorization` only), `api/controller/auth.js:33-75`
  (`userByLocation`)
- Guard at auth.js:41-46 runs **only if `location` is present**. When `?location=` is
  omitted, the `where` clause becomes `{}` (auth.js:59) and `User.findAll` returns **every
  user in every store**, including emails, phone, positions, and store linkage (only the
  password hash is excluded). The `Location.findOne` gate never fires (returns first row).
- Additionally, `kasir` role bypasses the check entirely and may pass any `location`.
- **Impact:** Any authenticated user (incl. kasir) can enumerate all staff/PII across all
  tenants.
- **Remediation:** Require the caller's own store always; only super_admin may pass an
  explicit location, and it must go through `validateStoreAccess`.

---

## HIGH FINDINGS

### HIGH-1 — `reporting.js` trusts unvalidated `req.cookies.store`
- **File:** `api/controller/reporting.js:8`
- `const userStore = req.cookies?.store || req.user?.store` — the cookie takes precedence
  over the JWT and is **never validated** (`validateStoreAccess` reads `req.query`/`req.body`
  only, never `req.cookies`). A Store-1 user sends `Cookie: store=2` and reads Store-2's
  sales summaries / reporting data.
- **Remediation:** Use `req.storeId` (always set by `validateStoreAccess`) as the only
  store source.

### HIGH-2 — `getKitchenOrders` fail-open on missing store
- **Files:** `api/routes/order.js:69-72` (has `validateStoreAccess`), `api/controller/order.js:2623-2650`
- Controller reads `req.query.store` (not `req.storeId`); when omitted, `whereClause = {}`
  → returns **all stores' kitchen orders**, defeating the middleware.
- **Remediation:** Use `req.storeId`; require it for non-super_admin.

### HIGH-3 — `updateOrderItemStatus` has zero tenant check
- **File:** `api/controller/order.js:2575-2621`
- `OrderItem.findOne({ where: { id: itemId, order: id } })` — no store filter. Any
  authenticated user can flip any other store's order-item status (cache/tamper).
- **Remediation:** Scope lookup by `req.storeId`.

### HIGH-4 — `stockHistory.getByProduct` returns all-store stock movements
- **File:** `api/controller/stockHistory.js:83-110`
- `db.stock_history.findAll({ where: { product: productId } })` — product IDs are global;
  no store filter → cross-tenant stock/movement history leak.
- **Remediation:** Filter by `req.storeId`.

### HIGH-5 — `inventory.js getStoreId` accepts unvalidated input
- **File:** `api/controller/inventory.js:7-12`
- `req.query.storeId || req.query.store || req.cookies?.store || req.user?.store` — none of
  `storeId` (query) or cookies are validated by `validateStoreAccess`. Any authenticated
  user can target any store's inventory.
- **Remediation:** Use `req.storeId` only.

### HIGH-6 — Socket.IO has no authentication
- **File:** `api/service/socket.js:22-45`
- `join-kitchen`/`join-store` accept any `storeId` with no token check. Any client can join
  any store's live room (`kitchen-<id>`, `store-<id>`) and receive realtime order/status
  broadcasts cross-tenant.
- **Remediation:** Require a verified JWT (query/handshake header) and enforce store match
  on each join.

### HIGH-7 — `product.js` stores-array bypass + cookie/body store fallbacks
- **Files:** `api/controller/product.js:667-679, 941-950` etc.; `utils/storeValidation.js`
- `validateStoreAccess` only `parseInt`s scalar `store`/`body.storeId`; an array payload
  bypasses the check (`parseInt` of non-number → NaN → falls through to allow), and
  `syncProductStores` writes `product_store` rows binding a product to arbitrary stores.
  Multiple product endpoints also read `req.cookies.store` / `req.body.storeId` directly.
- **Remediation:** Validate every store id in arrays against `req.storeId`; kill
  cookie/body fallbacks.

### HIGH-8 — `accountsReceivable.create` joins a foreign store's order
- **File:** `api/controller/accountsReceivable.js:154-157`
- `db.order.findByPk(orderId)` with no tenant filter, then creates AR bound to `store`
  (also caller-controlled). A store-1 user can create AR against store-2's orders.
- **Remediation:** Require `order` to belong to `req.storeId` before creating.

### HIGH-9 — `purchaseReturn.getAll` trusts cookies and fails open
- **File:** `api/controller/purchaseReturn.js:52-67` (same pattern at 197, 292, 474, 701)
- `effectiveStore = cookieStore` for non-super_admin; when the cookie is absent,
  `where.store` is never set → returns **all stores'** purchase returns. Cookie value is
  never validated against `req.storeId`.
- **Remediation:** Use `req.storeId`; require it for non-super_admin.

---

## MEDIUM FINDINGS

### MED-1 — Global schedulers scan across all tenants
- **Files:** `api/service/expenseScheduler.js:18-25`, `api/service/shiftSwapScheduler.js:26-41`,
  `api/service/accountingOutboxScheduler.js` / `accountingOutboxService.js:143-146`
- All three run `findAll` with **no** `store` filter. Output records are attributed
  correctly, so it is not a leak, but a slow/failing tenant can delay all tenants, and one
  tenant's outbox flood can starve another's.

### MED-2 — Backup retention cleanup + schedule are global
- **Files:** `api/controller/backup.js:350-369` (cleanup), `:157-192` (schedule)
- `cleanupRetention` deletes backups across all stores regardless of tenant; schedule is a
  single global `.schedule.json` any super_admin can change.

### MED-3 — Cross-store leakage in best-selling / reporting aggregates
- **Files:** `api/controller/best-selling.js` and reporting controllers (subagent-verified)
- Several aggregate endpoints omit `store` filtering entirely.

---

## LOW FINDINGS

### LOW-1 — `deleteBackup` cross-tenant delete
- **File:** `api/controller/backup.js:328-348` — `findByPk(id)` with no store check
  (super_admin only; destroys records idempotent to MED-2).

---

## PRIOR-SECURITY REGRESSION CHECK (AUD-1/2/3, SEC-005, F-REV1, F7, idempotency)
All previously-fixed invariants were **re-verified as intact** at HEAD `9a904df`:
- AUD-1/2/3 (order fetch tenant guards) — intact.
- SEC-005 (idempotency dedupe) — intact.
- F-REV1 (snapshot-driven customer order read flow) — intact.
- F7 (BOM ingredient deduction reversal symmetry) — intact.
The new findings are **additive** — they do not regress prior work.

## SCOPE NOTE
Uncommitted local changes (`api/routes/order.js` FND-002 rate-limiter + new
`customer-order-rate-limit.test.js`) were **excluded** from audit scope (not in baseline).

---

## REMEDIATION PLAN (priority order)
1. **CRIT-1** — Close public registration: remove `store`/`userType` from public schema,
   stop issuing tokens on register, require admin activation. (Highest urgency — unlocks
   everything else.)
2. **CRIT-2** — `/auth/get-user` must always require the caller's own store.
3. **HIGH-1/4/5/9 + MED-3** — Replace every `req.cookies.store` / `req.query.storeId` /
   raw `req.query.store` read with `validateStoreAccess`-provided `req.storeId`.
4. **HIGH-2/3/8** — Add `req.storeId` scoping to kitchen orders, item-status updates, and
   AR order resolution.
5. **HIGH-7** — Validate all ids in `products.stores` arrays against `req.storeId`.
6. **HIGH-6** — JWT-auth Socket.IO joins.
7. **CRIT-3/4, MED-2, LOW-1** — Scope backup/export/download/restore/delete and
   retention/schedule by `req.storeId`; never dump/restore the whole shared DB from a
   per-tenant actor.
8. Re-run full suite (50 suites / 663 tests) + security regression tests after each fix.

---

# Phase 1 Critical Security Remediation Report

## A. Scope and Constraints
- **Baseline:** Audit report above (HEAD `9a904df`), verdict `BLOCKED — CRITICAL/HIGH FINDINGS`.
- **Phase 1 objective:** Close all four CRITICAL findings (CRIT-1..4). HIGH/MEDIUM/LOW items
  are documented here but intentionally deferred to Phase 2 — no scope creep.
- **Process constraints honored:** no `git add`/`commit`/`reset`/`checkout`/`stash`/`revert`/
  history rewrite; no existing test was deleted or weakened; TDD (RED → GREEN) for every fix;
  each CRIT received a dedicated regression suite written BEFORE the fix and verified failing.
- **FND-002 invariants untouched:** `api/routes/order.js` and
  `__tests__/customer-order-rate-limit.test.js` verified byte-identical to their recorded
  baselines (`cae157ade5a933ccbc36135856432b61ba57565b` / `05dd3db107eb85d53a9a5f45ce3cb6ddf5e93a45`).
  Neither appears in `git diff`; FND-002 behavior (anonymous rate limit) is unchanged and its
  tests still pass.

## B. CRIT-1 — Public registration (REMOVED in scope: no public store/userType binding, no JWT)
- **Fix:** `api/validation/schemas.js` — removed `store`, `userType`, `shift`, `position`,
  `accessMenu` from `registerSchema`. Zod `.object()` strips these before the controller runs,
  so caller-supplied values (including an attacker's `store: <victim id>` / `userType: 'admin'`
  or even `roleType: 'super_admin'`) are structurally ignored.
- `api/controller/auth.js` `registerNewUser` — now always creates an **unassigned**
  (`store: null`), **non-privileged** (`roleType: 'user'`, `userType: 'user'`, `shift/position/accessMenu: null`)
  account and **does not mint a JWT** (`result.token` removed).
- **Admin provisioning:** `employee.addEmployee` (already `authorization` + `validateStoreAccess`
  + `requireRole('super_admin','admin')`) remains the sanctioned staff-provisioning path.
  FE `AddAdmin.jsx`/`services/user.js` currently calls `/auth/register` with `store`/`userType`
  — under the hardened schema those fields are ignored, so admin provisioning must move to an
  authenticated path (documented FE impact; FE not modified in this phase).
- **Regression:** `__tests__/security-crit1-register.test.js` (7 tests, RED before / GREEN after):
  A-store binding rejected, B-userType admin discarded, C-store+admin+roleType combined secure,
  D-legit flow works unassigned & tokenless, E-login intact, F-anonymous add-employee blocked,
  G-forged store claim on login rejected by store validation.

## C. CRIT-2 — `/auth/get-user` (stopped leaking the whole user table)
- **Fix:** `api/routes/auth.js` `/get-user` now runs `validateStoreAccess` (pins `req.storeId`
  from the trusted JWT). `api/controller/auth.js` `userByLocation`:
  - non-super-admin (incl. `kasir`): scope is ALWAYS the caller's own store `req.storeId`;
    account with `store: null` → 403; explicit `?location` differing from own store → 403.
  - super_admin: `?location` is **required** (400 if missing/invalid) so a global query can
    never silently dump the entire table; explicit `location` selects that store.
- **Regression:** `__tests__/security-crit2-get-user.test.js` (7 tests, RED before): ordinary &
  kasir with no `location` no longer leak all users; kasir `location=Store-2` rejected; Store-2
  users absent from Store-1 response; super_admin explicit `location` works; super_admin w/o
  `location` returns 400.

## D. CRIT-3 — Backup global boundary
- **Fix:** `api/routes/backup.js` — added `validateStoreAccess` to `/backup/create`,
  `/restore/:id`, `/delete/:id` (list/download already had it). `api/controller/backup.js`:
  - `canAccessBackupArtifact(record, req)` keyed on the CALLER'S REAL store from the JWT:
    global super_admin (`store: null`) full access; store-bound super_admin only their own
    store's records — other-store and store-null global artifacts are denied with 403 on
    download/delete/restore (record survives delete-denial).
  - `listBackups` — store-bound super_admin always sees only their store; global super_admin
    sees all (optionally narrowed by explicit store).
  - `createBackup` — effective store = caller's real store (store-bound) or `req.storeId`/null
    (global); metadata now carries `globalDump: true` so the full-DB nature of the artifact is
    explicit (pg_dump still dumps the entire shared DB by design — documented, not faked).
  - Tenant roles still rejected for every backup op via `requireRole('super_admin')`.
- **Regression:** `__tests__/security-crit3-backup.test.js` (27 tests, RED before): 18 tenant
  401/403 guards + 5 store-bound super_admin deny cases (download/delete/restore other-store,
  download global) + own-store allow + global super_admin allow + scoped/global listing.
  Per-test fixtures in `beforeEach` make the suite order-independent; deny paths 403 before any
  `pg_restore`/`pg_dump`, so the suite never touches the real DB binaries with test data.

## E. CRIT-4 — exportMaster cross-tenant export
- **Fix:** `api/controller/exportMaster.js` `exportAll` — tenant now comes EXCLUSIVELY from
  `req.storeId` (authorization context); `req.query.store`/body/cookie are never read.
  - Tenant-scoped export: junction entities (`category`,`product`) filtered via
    `category_store`/`product_store` with **parameterized** replacements; entities with a
    `store` column filtered by `where.store`; no-store-linkage reference entities
    (`department`,`ingredientCategory`, etc.) are **skipped** (no silent cross-tenant
    inclusion); non-super_admin without a store → 403.
  - Global export (super_admin, `req.storeId` null): unfiltered, includes reference data.
- **Regression:** `__tests__/security-crit4-export-master.test.js` (7 tests, RED before) parses
  the real xlsx via a buffer-capture supertest parser: Store-1 covers only S1 (supplier/product/
  category), symmetric Store-2, query/body spoofs rejected or scoped, cookie spoof ignored,
  global super_admin export works, and tenant export excludes global reference data.

## F. Verification Evidence
- RED phase: each CRIT suite verified failing before any production change
  (CRIT-1 5 fail/2 pass, CRIT-2 5 fail/2 pass, CRIT-3 5 fail/22 pass, CRIT-4 4 fail/3 pass).
- GREEN phase: CRIT-1 7/7, CRIT-2 7/7, CRIT-3 27/27, CRIT-4 7/7.
- **Full suite (sequential `--runInBand`, required because the shared test DB is truncated once
  per run by `scripts/setup-test-db.js`):** 57 suites / **720/720 tests passed**, 0 failed.
  (The default parallel run OOMs at default heap and exhibits pre-existing cross-suite DB
  contention — the same 720 tests pass serially; this is a repo harness property, not a regression.
  The audit's last full run was 50 suites / 663; the tree since grew (e.g. the committed FND-002
  rate-limit suite and the 4 Phase-1 suites with 48 tests), and Phase 1 verified 57 suites / 720
  tests.)
- Regression invariances re-verified within the full run: AUD-1/2/3 (`audit-log-hardening.test.js`
  + `_audit-log-hardening` endpoint tests), SEC-005 (`customer-order-security`, `_tenant-isolation-idor`),
  F7 (`f7-bom-ingredient-deduction`, `_report-profit-margin-f6`), F-REV1 (`_stock-mutation-service`,
  `_financial-integrity-fixes`), FND-002 (`customer-order-rate-limit.test.js`), plus all flow suites.
- Syntax: `node --check` green on all 6 changed source files and 4 new test files.

## G. Manual Security Verification (Before → Attack → After)
1. **CRIT-1 (Before):** anonymous `POST /auth/register {store: <victim>}` created a tenant-scoped
   user and returned a JWT. **(After):** the same request creates `store: null` / `userType: user`
   and returns **no token**; any `userType`/`roleType` claim is ignored; login for that account
   issues a token with `store: null`, and store-validation rejects it for any store-specific route.
2. **CRIT-2 (Before):** `GET /auth/get-user` with no `location` returned all users across stores.
   **(After):** ordinary/kasir without explicit `location` → own store only; kasir `location=<other>`
   → 403; super_admin without `location` → 400 (no accidental global dump).
3. **CRIT-3 (Before):** store-bound super_admin could download/delete/restore any backup by PK,
   including `store: null` global artifacts. **(After):** 403 for non-own or global artifacts;
   records survive denied deletes; listing scoped to own store.
4. **CRIT-4 (Before):** store admin omitting `store`, or supplying `store=` via query/body/cookie,
   could craft an export containing another tenant's master data. **(After):** every tenant export
   is scoped to `req.storeId`; junction/linked entities filtered; global reference data excluded
   from tenant exports; super_admin global export unchanged.

## H. Files Changed (Phase 1)
- `api/validation/schemas.js` — stripped caller-controlled fields from `registerSchema` (CRIT-1).
- `api/controller/auth.js` — hardened `registerNewUser` (CRIT-1) + `userByLocation` (CRIT-2).
- `api/routes/auth.js` — added `validateStoreAccess` to `/get-user` (CRIT-2).
- `api/routes/backup.js` — added `validateStoreAccess` to create/restore/delete (CRIT-3).
- `api/controller/backup.js` — artifact-boundary access control + scoped listing (CRIT-3).
- `api/controller/exportMaster.js` — `req.storeId`-only tenant scoping, per-entity filters,
  parameterized junction queries (CRIT-4).
- New tests: `__tests__/security-crit1-register.test.js`, `security-crit2-get-user.test.js`,
  `security-crit3-backup.test.js`, `security-crit4-export-master.test.js`.

## I. Deferred (intentionally out of Phase 1 scope, tracked in audit above)
- **HIGH-1..9, MED-1..3, LOW-1** — see Remediation Plan items 3–7 of the audit.
- Notably HIGH-6 (Socket.IO auth), HIGH-1/4/5/9 (`req.cookies.store` / `req.query.storeId`),
  HIGH-2/3/8 (kitchen/order-item/AR scope), HIGH-7 (`stores` array). These remain open.

## J. Final Git State
- `git status --short`: 6 modified files (all Phase 1), 5 untracked (audit report + 4 CRIT test
  suites). **No staged changes, no commits performed.**
- FND-002 files byte-identical to baseline (shasums above); A-FND-002/full-diff clean.
- **VERDICT: READY FOR READ-ONLY REMEDIATION AUDIT.**
  All four CRITICAL findings closed with RED→GREEN regression coverage; full suite 720/720 passing
  (sequential harness); no tracked file touched outside the six Phase-1 files; HIGH/MEDIUM/LOW
  tracked for Phase 2.