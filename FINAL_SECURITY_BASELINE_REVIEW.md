# FINAL SECURITY BASELINE REVIEW

**Mode:** READ-ONLY. No production code, test, migration, or configuration file was modified during this review. No commit, push, reset, stash, revert, or checkout was performed.

---

## 1. Executive Summary

This review independently re-verified the entire working tree against every prior security report (`SECURITY_AUDIT_REPORT.md`, `PHASE2_HIGH_AUDIT_REPORT.md`, `SECURITY_REAUDIT_REPORT.md`, `SECURITY_REAUDIT_FINAL.md`, `SECURITY_PHASE3_AUDIT.md`, `SECURITY_PHASE3_REMEDIATION.md`, `FINAL_SECURITY_AUDIT.md`, `SECURITY_RESIDUAL_REMEDIATION.md`), read the complete `git diff` file-by-file (not just the files named in reports), and re-ran the full test suite twice.

**Everything the prior reports claim was independently confirmed accurate.** All 72 tracked-modified files were individually attributed to a specific, legitimate finding or a consistent, well-documented pattern sweep. No previously-verified fix was weakened, reverted, or regressed. C-7, C-9, MED-1, and MED-2 are all correctly and completely implemented exactly as `SECURITY_RESIDUAL_REMEDIATION.md` describes. Full regression passed twice, cleanly, at exactly the expected 89/89 suites, 939/939 tests.

**However, the mandatory "Security Pattern Final Sweep" (§11 of the review brief) — searching the full diff for `req.cookies.store` and equivalent caller-controlled tenant sources — surfaced three live, exploitable, previously-undiscovered vulnerabilities in `api/controller/stockOpname.js`, in functions that were never touched by any of the five prior remediation passes despite the same file receiving extensive fixes elsewhere (N-4, N-11's `resolveStoreId` sweep covers 6 other sites in this exact file).** These are new findings, not a regression of prior work, and per the "do not falsely approve" principle established throughout this engagement, they must block the baseline verdict.

### Verdict: 🔴 NOT APPROVED — BASELINE COMMIT BLOCKED

Blocking reason: 3 unresolved HIGH-severity findings in `api/controller/stockOpname.js` (new, first discovered this session — see §10, §13).

---

## 2. Baseline

| | |
|---|---|
| Branch | `master` |
| HEAD SHA | `ee10b0760db97a2a3b6449435699ef8fb47c1d9e` (unchanged before/after this review) |
| Working tree status | 118 items changed from HEAD: 72 tracked-modified, 46 untracked — **identical before and after this review** |
| Staged changes | 0 (confirmed via `git diff --cached --name-only`) |

---

## 3. Change Attribution

Every one of the 72 tracked-modified files was individually traced this session (not assumed from prior report labels). Legend: **P1** = Phase 1 (CRIT/HIGH), **RA** = re-audit N-series/C-series, **P3** = Phase 3, **RES** = residual remediation (C-7/C-9/MED-1/MED-2), **DEP** = dependency lockfile.

| File | Change Area | Phase/Finding | Expected? |
|---|---|---|---|
| `__tests__/attendance-clock-store.test.js` | test fixture hygiene (unique names/emails, safer cleanup) | test-only, no security assertion changed | ✅ Yes — benign |
| `__tests__/audit-log-hardening.test.js` | fixture update | N-5 real-table contract | ✅ Yes |
| `__tests__/customer-order-create-flow.test.js` | fixture update | N-5 | ✅ Yes |
| `__tests__/customer-order-idempotency-concurrency.test.js` | fixture update | N-5 | ✅ Yes |
| `__tests__/customer-order-rate-limit.test.js` | fixture update (added `tableId`) | N-5 (explicitly listed in `SECURITY_REAUDIT_REPORT.md`) | ✅ Yes |
| `__tests__/customer-order-security.test.js` | fixture update | N-5 | ✅ Yes |
| `__tests__/f7-bom-ingredient-deduction.test.js` | fixture update | N-5 | ✅ Yes |
| `__tests__/order-cancel-flow.test.js` | rewritten to post-fix contract | Phase 3 F-03 | ✅ Yes |
| `__tests__/receipt-html-xss.test.js` | fixture update | N-5 | ✅ Yes |
| `__tests__/sales-return-hardening.test.js` | 403 fail-closed contract | N-5 | ✅ Yes |
| `__tests__/store-isolation.test.js` | 2 tests updated to fixed contract, 1 fixture bug corrected | Residual C-7 | ✅ Yes |
| `__tests__/tenant-isolation-idor.test.js` | 2 assertions strengthened (200/201→403) | C-1..C-4 (`authorizedStoreIds` fail-closed) | ✅ Yes |
| `api/controller/accountsReceivable.js` | AR row lock + guarded update + idempotency; HIGH-8 order-ownership check | P3 F-01, P1 HIGH-8 | ✅ Yes |
| `api/controller/auth.js` | register hardening; get-user store scoping | P1 CRIT-1, CRIT-2 | ✅ Yes |
| `api/controller/backup.js` | artifact-boundary access control; **this session: schedule authorization** | P1 CRIT-3, RES MED-2 | ✅ Yes |
| `api/controller/bom.js` | removed cookie fallback | MED-3-class cookie sweep | ✅ Yes |
| `api/controller/businessTrip.js` | `resolveStoreId` | N-11 | ✅ Yes |
| `api/controller/category.js` | `authorizedStoreIds` (C-2); super_admin cookie fallback retained (safe, see §10) | RA C-2 | ✅ Yes |
| `api/controller/currency.js` | `resolveStoreId` | N-11 | ✅ Yes |
| `api/controller/delivery.js` | `authorizedStoreIds` | RA C-4 | ✅ Yes |
| `api/controller/discount.js` | `authorizedWriteStore` | MED-3-class cookie sweep | ✅ Yes |
| `api/controller/employeePerformance.js` | removed cookie fallback + fail-closed | MED-3-class cookie sweep | ✅ Yes |
| `api/controller/exportMaster.js` | `req.storeId`-only tenant scoping | P1 CRIT-4 | ✅ Yes |
| `api/controller/goodsReceipt.js` | `resolveStoreId` | N-11 | ✅ Yes |
| `api/controller/goodsRequest.js` | `resolveStoreId` | N-11 | ✅ Yes |
| `api/controller/ingredient.js` | `resolveStoreId` | N-11 | ✅ Yes |
| `api/controller/ingredientCategory.js` | store filter added | RA C-6 | ✅ Yes |
| `api/controller/inventory.js` | removed `getStoreId`/cookie/query.storeId | P1 HIGH-5 | ✅ Yes |
| `api/controller/location.js` | tenant-scoped `getLocationById` | **RES C-7** | ✅ Yes |
| `api/controller/member.js` | `!record.store \|\| mismatch` guard (2 sites) | **RES C-9** | ✅ Yes |
| `api/controller/notification.js` | store scoping | RA C-5 | ✅ Yes |
| `api/controller/order.js` | HIGH-2/3 fail-closed; N-5 table authority; F-03/F-04/F-05 | P1 HIGH-2/3, RA N-5, P3 F-03/F-04/F-05 | ✅ Yes |
| `api/controller/pos.js` | N-1/N-2/N-3 store scoping; F-07 deadlock wrap; C-10/C-11 product scope | RA N-1/N-2/N-3/C-10/C-11, P3 F-07 | ✅ Yes |
| `api/controller/product.js` | stores-array foreign-id rejection | P1 HIGH-7 | ✅ Yes |
| `api/controller/productBundle.js` | removed cookie fallback | MED-3-class cookie sweep | ✅ Yes |
| `api/controller/productionOrder.js` | `resolveStoreId` | N-11 | ✅ Yes |
| `api/controller/purchaseOrder.js` | `resolveStoreId` | N-11 | ✅ Yes |
| `api/controller/purchasePayment.js` | (diff is 2 lines — verified unrelated to cookie logic; cookie fallback present but explicitly documented dead/safe by `SECURITY_REAUDIT_FINAL.md §H`) | N-11-adjacent | ✅ Yes |
| `api/controller/purchaseReturn.js` | removed cookie/fail-open | P1 HIGH-9 | ✅ Yes |
| `api/controller/report.js` | fail-closed guards added | MED-3-class cookie sweep | ✅ Yes |
| `api/controller/reportExport.js` | fail-closed guard added | HIGH-10-class | ✅ Yes |
| `api/controller/reporting.js` | removed cookie trust, fail-closed | P1 HIGH-1 | ✅ Yes |
| `api/controller/shift.js` | `authorizedStoreIds` | RA C-3 | ✅ Yes |
| `api/controller/stockHistory.js` | store filter | P1 HIGH-4 | ✅ Yes |
| `api/controller/stockOpname.js` | `resolveStoreId` (N-4, 6 sites) — **but see §10: 3 sites in this same file were NOT covered and remain vulnerable** | RA N-4 (partial) | ⚠️ **Partially — see finding** |
| `api/controller/supplier.js` | `!supplierStores.length \|\| mismatch` guard (update + delete) | **RES C-9** | ✅ Yes |
| `api/controller/taxConfig.js` | removed cookie fallback (7 sites) | MED-3-class cookie sweep | ✅ Yes |
| `api/controller/type-payment.js` | C-1 create scoping; **RES C-9 edit guard** | RA C-1, RES C-9 | ✅ Yes |
| `api/controller/waiter-request.js` | N-5 table authority; C-8 | RA N-5, C-8 | ✅ Yes |
| `api/routes/auth.js` | `validateStoreAccess` added to `/get-user` | P1 CRIT-2 | ✅ Yes |
| `api/routes/backup.js` | `validateStoreAccess` added to create/restore/delete | P1 CRIT-3 | ✅ Yes |
| `api/service/accountingOutboxService.js` | `FOR UPDATE SKIP LOCKED` drain; failure semantics | P3 F-02/F-06 | ✅ Yes |
| `api/service/accountingService.js` | atomic sequence, dedupe-after-lock, throw-on-failure | P3 F-02/F-06/F-08 | ✅ Yes |
| `api/service/expenseScheduler.js` | bounded batch + export | **RES MED-1** | ✅ Yes |
| `api/service/reportDefs/*.js` (7 files) | `assertReportStore`/`getReportStore` adoption | MED-3 | ✅ Yes |
| `api/service/shiftSwapScheduler.js` | bounded batch | **RES MED-1** | ✅ Yes |
| `api/service/socket.js` | handshake authentication | P1 HIGH-6 | ✅ Yes |
| `api/validation/schemas.js` | stripped caller-controlled register fields | P1 CRIT-1 | ✅ Yes |
| `package-lock.json`, `yarn.lock` | dependency lockfile churn | DEP, unrelated to security logic | ✅ Yes — benign |
| `package.json` | `jest.testTimeout: 30000` | P3 test infra | ✅ Yes |
| `utils/storeValidation.js` | `normalizeStoreIds`/`authorizedStoreIds`/`authorizedWriteStore`; N-11 fail-closed | RA (C-1..C-4 root cause fix), N-11 | ✅ Yes |
| `utils/tenantScope.js` | `resolveStoreId` export | N-11 | ✅ Yes |

**Untracked files** (46): 8 documentation reports (all previously reviewed, unchanged by this session), 37 new test files (all traced to specific findings across P1/P3/RA/RES), 1 new production helper (`api/service/reportDefs/getReportStore.js`, MED-3), 1 migration (`db/migrations/20260909000001-phase3-accounting-integrity.js`, P3 — cycle-tested in a prior session). All accounted for.

**No unrelated/unknown changes were found.** Every file's diff was read and matches a legitimate, already-reported security finding or an internally-consistent pattern sweep. No development feature work, no refactor-for-its-own-sake, no formatting-only churn beyond the two lockfiles (which reflect real dependency installs from the `zod`, `express-rate-limit`, `@sentry/node` additions visible in `package.json`, not unexplained).

---

## 4. Phase 1 Sanity Review

Focused re-check of the areas named in the review brief, this session:

- **Register privilege injection (CRIT-1):** `schemas.js` still strips `store`/`userType`/`shift`/`position`/`accessMenu` from `registerSchema`; `auth.js registerNewUser` still creates `store:null`/`roleType:'user'` and issues no token. Unchanged since Phase 1.
- **JWT/user binding:** no diff touches JWT signing/verification (`utils/authorization.js` is not in the changed-file list at all).
- **get-user tenant scope (CRIT-2):** `/get-user` still requires `validateStoreAccess`; unchanged.
- **Backup authorization (CRIT-3 + RES MED-2):** `canAccessBackupArtifact` unchanged; the only new logic (`requireGlobalSuperAdmin`) is additive and gates two functions (`getSchedule`/`setSchedule`) that previously had no store-boundary check at all — this narrows access, never widens it.
- **Export authorization (CRIT-4):** `exportMaster.js`'s `req.storeId`-only sourcing unchanged.
- **Reporting tenant scope (HIGH-1):** `effectiveTenantStore()` still ignores `req.cookies.store`/`req.query.store`; unchanged.
- **Kitchen/socket authorization (HIGH-2, HIGH-6):** unchanged from prior verification.
- **Order-item IDOR (HIGH-3):** parent-order ownership check in `updateOrderItemStatus` unchanged.
- **stockHistory (HIGH-4):** unchanged.
- **Inventory input trust (HIGH-5):** `getStoreId` removal unchanged.
- **Product stores-array (HIGH-7):** unchanged.
- **AR tenant isolation (HIGH-8):** `accountsReceivable.js`'s order-ownership check (added this engagement, verified in the Phase 3 session) unchanged this session.
- **purchaseReturn tenant isolation (HIGH-9):** unchanged.

**No Phase 1 security boundary was weakened.**

---

## 5. Phase 2 Sanity Review

- **Stock atomicity / non-negative:** `product_stock_non_negative` and `product_store_stock_stock_non_negative` CHECK constraints re-verified live in `pg_constraint` this session — present, unmodified.
- **BOM inventoryMode, purchase receiving, split bill, sales return, cancellation:** none of the files implementing these (`stockMutationService.js`, `bom.js`'s deduction logic, `salesReturn.js`, `splitBill.js`) appear in the changed-file list except `bom.js`'s single cookie-removal hunk (checked directly — a store-source change only, not a deduction-logic change).
- **Order idempotency:** `order_store_idempotencykey_unique`/`order_orderNumber_key`/`order_public_token_unique` all re-verified live this session.
- **Order lifecycle / tenant isolation:** 38-suite/513-test targeted sweep (§11) all pass, including every order-, stock-, sales-return-, split-bill-, and tenant-isolation-named suite.

**No Phase 2 guarantee was regressed.**

---

## 6. Phase 3 Sanity Review

| Finding | Verified preserved | Evidence |
|---|---|---|
| F-01 (AR lock + idempotency + bounded payment) | ✅ | `accountsReceivable.js` unchanged this session; 4/4 `accounts-receivable-concurrency.test.js` pass |
| F-02 (journal dedupe + sequence + uniqueness) | ✅ | `accountingService.js`/`accountingOutboxService.js` unchanged this session; 7/7 `accounting-journal-concurrency.test.js` pass; `journal_entry_store_source_reference_uniq`/`journal_entry_store_entrynumber_uniq`/`journal_entry_sequence` all re-verified live |
| F-03 (resurrection protection) | ✅ | `order.js` unchanged this session (only touched in the prior Phase 3/RA sessions); 3/3 `order-resurrection-rejection.test.js` + 3/3 `order-cancel-flow.test.js` pass |
| F-04 (unique-collision allowlist) | ✅ | 3/3 `order-unique-collision-hardening.test.js` pass |
| F-05 (table locking) | ✅ | 1/1 `customer-order-table-lock.test.js` pass |
| F-06 (outbox failure semantics) | ✅ | unchanged; covered by the F-02 suite's "never marked posted" test |
| F-07 (deadlock, documented residual) | ✅ | `pos.js`'s `withDeadlockRetry` wrap and `salesReturn.js`'s documented non-refactor both unchanged |
| F-08 (provisioning race) | ✅ | 2/2 `accounting-provisioning-concurrency.test.js` pass |

**No Phase 3 fix was modified this session.**

---

## 7. Residual Remediation Review

### C-7
`api/controller/location.js` `getLocationById` still rejects `dbId !== req.storeId` for non-super-admin with `404`, evaluated **before** any `Location.findByPk` call — this is an access-boundary check, not response filtering (confirmed by reading the function: the guard `return`s before the query even runs). `super_admin` path unchanged. 7/7 `security-c7-location-tenant-isolation.test.js` pass.

### C-9
All five instances re-verified present and unchanged:
- `member.js editMember` (line ~313): `!member.store || mismatch` ✅
- `member.js deleteMember` (line ~429): `!member.store || mismatch` ✅
- `type-payment.js editTypePaymentById` (line ~303): `!existing.store || mismatch` ✅
- `supplier.js update` (line ~938): `supplierStores.length === 0 || !includes` ✅
- `supplier.js delete` (line ~1101): `supplierStores.length === 0 || !includes`, explicit `roleType !== 'super_admin'` check ✅

`null`-store behavior: confirmed a falsy/empty store record can no longer bypass the guard for any non-super-admin caller in all five locations. Cross-tenant (non-null, foreign store) records remain protected — unaffected code path, still `mismatch → 403`. 10/10 `security-c9-null-store-ownership-bypass.test.js` pass.

### MED-1
`expenseScheduler.js`: `MAX_TEMPLATES_PER_TICK = 20`, `order:[['nextDueDate','ASC']]`, `limit` present on the `db.expense.findAll` call — confirmed unchanged this session. `shiftSwapScheduler.js`: `MAX_SWAPS_PER_TICK = 50`, `order:[['id','ASC']]`, `limit` present — confirmed unchanged. Both schedulers retain their original global, single-process, cross-instance-lock architecture (`tryAcquireSchedulerLock` calls unchanged) — bounding was additive, not a redesign. 4/4 `security-med1-scheduler-resource-isolation.test.js` pass.

### MED-2
`backup.js`: `requireGlobalSuperAdmin(req, res)` present and called at the top of both `getSchedule` and `setSchedule`, checking `req.user?.store != null` → `403`. `cleanupRetention()` itself is byte-identical to before this fix (confirmed: the function body was not part of this session's diff review findings; only the two schedule-configuration endpoints changed). 5/5 `security-med2-backup-schedule-authorization.test.js` pass.

**All four residual findings remain correctly and completely closed.**

---

## 8. Test Contract Review

- All four residual-finding test files (`security-c7-*`, `security-c9-*`, `security-med1-*`, `security-med2-*`) use real HTTP (`supertest`) against the real route/controller/DB chain, real Postgres, dynamically-created fixtures (`db.location.create`, etc.), and JWTs signed with claims tied to the dynamically-created fixture ids — no hardcoded store-id/JWT mismatch was found in any of the four new suites (unlike the pre-existing `store-isolation.test.js` bug the C-7 fix exposed and corrected).
- **C-9 supplier-delete test** (flagged by the review brief as needing careful inspection because of the documented false-RED incident): re-read this session. The test (`'store A admin CANNOT delete a null-store (global) supplier'`) correctly asserts `res.status !== 200` and `fresh !== null` after the request — both conditions are meaningfully different assertions (status code AND persisted-row survival), so a repeat of the original false-RED (a `ReferenceError`→500 satisfying only the status assertion) would still be caught today if it recurred, because the row-survival assertion is independent of the status code. No mocked ownership check — the guard runs in the real `supplier.js delete` function against a real DB row.
- No test in the reviewed set mocks away a store/ownership check to force a pass; no test-only security bypass or environment-specific bypass was found in any of the four new files or in the two pre-existing files touched this session (`store-isolation.test.js`, `tenant-isolation-idor.test.js`).

---

## 9. Database / Migration Verification

| Check | Result |
|---|---|
| Migration files on disk | 213 |
| `SequelizeMeta` rows | 213 (no drift) |
| Phase 3 migration present | ✅ `20260909000001-phase3-accounting-integrity.js` |
| New/unexpected migration from residual remediation | None — confirmed no new file under `db/migrations/` beyond the pre-existing Phase 3 one |
| Destructive migration | None found |
| Rewritten existing migration | None — all 213 files' `SequelizeMeta` entries match; no file was edited retroactively |
| `journal_entry_store_source_reference_uniq` | ✅ live |
| `journal_entry_store_entrynumber_uniq` | ✅ live |
| `journal_entry_sequence` table | ✅ live |
| `ar_payment_arid_reference_uniq` | ✅ live |
| `order_store_idempotencykey_unique` | ✅ live |
| `order_orderNumber_key` | ✅ live |
| `order_public_token_unique` | ✅ live |
| `product_stock_non_negative` CHECK | ✅ live |
| `product_store_stock_stock_non_negative` CHECK | ✅ live |
| `cash_register_store_open_unique` | ✅ live |
| `purchase_payment_po_idempotencykey_unique` | ✅ live |

All constraints referenced by every prior audit re-confirmed present via direct `pg_indexes`/`pg_constraint` introspection this session (not assumed from ORM model definitions).

---

## 10. Regression Pattern Sweep

Systematic search across the full diff and, per the brief's explicit instruction to search broadly, the wider `stockOpname.js` file (since it appeared in the diff for other reasons), for: `record.store &&`, caller-controlled `req.cookies.store`/`req.query.store`/`req.body.store`, and unbounded global queries.

**No weakened `||`/`&&` logic, no commented-out security checks, and no reintroduced `record.store &&` bypass pattern were found anywhere in the diff** (the only matches for that literal string are this session's own explanatory code comments describing the now-fixed C-9 pattern).

**Finding: three live, unfixed cookie-trust vulnerabilities in `api/controller/stockOpname.js`, not covered by any prior remediation pass.**

`stockOpname.js` received extensive remediation for N-4 (export-selected) and N-11 (`resolveStoreId`, confirmed present at 6 sites including `create` at line 252). However, three additional functions in the **same file** were never touched and still read the raw, client-controlled `store` cookie — `cookie-parser` is mounted (`api/index.js:164`) and no route anywhere in the codebase ever calls `res.cookie('store', ...)`, so this cookie is entirely attacker-supplied on every request:

1. **`uploadExcel`** (line 1143): `let effectiveStore = req.cookies?.store || req.user?.store` — **the cookie is checked FIRST, ahead of the JWT claim.** `effectiveStore` is then used unmodified as `store:` in a `db.stockOpname.create(...)` inside a transaction (line ~1246), creating a real `stock_opname` record (with all uploaded line items) attributed to whatever store the cookie names. Route: `POST /stock-opname/upload-excel`, gated `requireRole('super_admin','admin')` — reachable by any store-scoped admin. **Impact: cross-tenant WRITE** — a Store A admin can inject a stock-opname draft into Store B by sending `Cookie: store=<B>` alongside their Excel upload.
2. **`checkExists`** (line 1414): `const effectiveStore = store || cookieStore` (query param first, cookie fallback when the query param is omitted) — `req.query.store` IS validated by `validateStoreAccess` when present, but when the caller simply **omits** `?store=` and instead sends a cookie, nothing validates it. Route: `GET /stock-opname/check-exists`, gated only `authorization + validateStoreAccess` (no `requireRole` — reachable by `kasir`). **Impact: cross-tenant READ** — discloses whether another store has a completed stock opname.
3. **`getCompositionItems`** (line 1450): identical pattern to `checkExists`. Route: `GET /stock-opname/composition-items`, same middleware (any authenticated role). **Impact: cross-tenant READ** — discloses another store's stock-opname composition/item-level data.

This is the exact same vulnerability class as the already-fixed HIGH-1 (`reporting.js`), HIGH-5 (`inventory.js`), HIGH-9 (`purchaseReturn.js`), and MED-3 (`reportDefs/*.js`) findings — "cookie value trusted over/alongside the JWT-pinned `req.storeId`" — but these three specific functions were missed by every prior sweep, including the one that fixed 6 *other* functions in this exact same file. No test in the repository (old or new) exercises `uploadExcel`, `checkExists`, or `getCompositionItems` with a cookie-based cross-tenant attack, which is why it was never caught by "green tests."

**Two other `req.cookies.store` occurrences were investigated and found safe, not new findings:**
- `category.js:423` — only reached inside the `roleType === 'super_admin'` branch, as the same "legacy cookie switch" store-selector pattern already documented as intentional for `super_admin` elsewhere (`utils/tenantScope.js`'s `resolveStoreId` comment). Not a tenant-isolation issue since `super_admin` already has unrestricted access.
- `purchasePayment.js` (4 sites) — `req.storeId || req.cookies.store`; `req.storeId` is always truthy for an assigned caller (short-circuits the cookie) because every purchase-payment route requires `authorization + validateStoreAccess` and N-11 already 403s unassigned accounts upstream. This exact reasoning is independently documented in `SECURITY_REAUDIT_FINAL.md §H` ("Effectively dead/safe"), and was re-confirmed by reading the route file this session.

No other new instances of any regression pattern (weakened logic, unbounded query, caller-controlled privilege field) were found anywhere else in the diff.

---

## 11. Targeted Test Results

| Suite group | Result |
|---|---|
| Residual remediation (C-7, C-9, MED-1, MED-2) | 26/26 PASS |
| C-series, N-series, crit, high, medium (combined) | 30 suites, 248/248 PASS (one transient cross-file failure investigated, non-reproduced on immediate rerun — see below) |
| Phase 2/3 + tenant-isolation + backup security (combined) | 38 suites, 513/513 PASS |

**Transient failure investigated:** `security-n1-invoice-send-idor.test.js` failed once inside the 30-suite combined run (an unrelated WhatsApp-mock assertion), passed 7/7 in isolation immediately after, and the identical combined run repeated cleanly (30/30) on the next attempt. This matches the pre-existing, previously-documented (in `FINAL_SECURITY_AUDIT.md §18` and the original Phase 3/re-audit reports) per-test-file Postgres connection-pool churn — not a deterministic failure, not related to any code change (no file in this test's code path was touched this session).

---

## 12. Full Regression

**Run #1:** 89/89 suites, 939/939 tests, PASS, 181.4s
**Run #2:** 89/89 suites, 939/939 tests, PASS, 158.8s

Two consecutive clean runs, exactly matching the expected baseline (89/89, 939/939) stated in the task brief.

---

## 13. Final Security Scorecard

| Area | Status |
|---|---|
| Phase 1 Critical | PASS |
| Phase 1 High | PASS |
| Phase 2 Tenant Isolation | PASS |
| Phase 2 Inventory Integrity | PASS |
| Phase 2 Business Integrity | PASS |
| Phase 3 Financial Integrity | PASS |
| Phase 3 Accounting | PASS |
| Phase 3 Concurrency | PASS |
| C-7 | PASS |
| C-9 | PASS |
| MED-1 | PASS |
| MED-2 | PASS |
| Cross-Phase Integration | PASS |
| Tenant Isolation | **FAIL** — 3 unresolved findings in `stockOpname.js` (§10) |
| Database Constraints | PASS |
| Migration Safety | PASS |
| Adversarial Testing | PASS (for all previously-scoped findings) |
| Full Regression Run #1 | PASS |
| Full Regression Run #2 | PASS |
| Remaining Findings | **3** (new, this session) |

---

## 14. Remaining Findings

**3 — all in `api/controller/stockOpname.js`, first discovered this session (§10):**

1. `uploadExcel` (line 1143) — HIGH — cross-tenant stock-opname record creation via `Cookie: store=<foreign>`, cookie takes precedence over the JWT claim.
2. `checkExists` (line 1414) — HIGH — cross-tenant existence disclosure via cookie fallback when `?store=` is omitted, reachable by any authenticated role.
3. `getCompositionItems` (line 1450) — HIGH — cross-tenant composition/item-data disclosure via the same pattern, reachable by any authenticated role.

None of these are a regression of any previously-verified fix — they are newly-discovered gaps in a file that received *other*, correct fixes but was not completely swept. Not fixed by this review (read-only mode).

---

## 15. Release Readiness

The codebase is **not** ready for the security-baseline commit as-is. Every previously-claimed fix (Phase 1, Phase 2, Phase 3, the final integration audit's own findings, and the residual C-7/C-9/MED-1/MED-2 remediation) is independently confirmed accurate, intact, and non-regressed — that work is solid and does not need to be redone. The blocker is narrow and specific: three functions in one file (`stockOpname.js`) that were never brought into the same `resolveStoreId`/`validateStoreAccess`-only discipline the rest of the codebase (including six *other* functions in this identical file) already follows.

**Recommendation:** remediate the three `stockOpname.js` findings using the exact same pattern already applied to the other six functions in that file (`resolveStoreId(req)` in place of the cookie reads, with a fail-closed 403/400 when unresolved), add regression coverage mirroring the existing N-4/N-11 suites, then re-run this baseline review. Given the fix pattern is already proven and repeated dozens of times elsewhere in this exact codebase, this is expected to be a small, low-risk, fast remediation — not a reason to distrust the rest of the (extensive, now four-times-independently-verified) security work.

No unrelated/development-only changes were found that would need to be separated before commit — the entire working tree is security-remediation-relevant and internally consistent (§3).

---

## 16. Final Verdict

# 🔴 NOT APPROVED — BASELINE COMMIT BLOCKED
