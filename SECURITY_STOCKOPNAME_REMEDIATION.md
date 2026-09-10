# SECURITY STOCKOPNAME REMEDIATION

**Target:** BE-POS-App — `api/controller/stockOpname.js`
**Scope:** SO-01, SO-02, SO-03 (from `FINAL_SECURITY_BASELINE_REVIEW.md`)
**Date:** 2026-09-09
**Starting commit:** `ee10b0760db97a2a3b6449435699ef8fb47c1d9e` (unchanged — no commits made)
**Mode:** TDD remediation (RED → FIX → GREEN), scoped strictly to the three named findings

---

## 1. Executive Summary

All three HIGH-severity findings that blocked the security baseline are closed, each with an independently-verified RED→GREEN cycle. The fix reuses the exact canonical `resolveStoreId(req)` pattern already present at six other sites in this same file (`getById`, `create`, `update`, `delete`, `changeStatus`, `downloadExcel`) — no new tenant-resolution mechanism was introduced. A repository-wide re-sweep for the same vulnerability class (18 files reference `req.cookies.store` in some form) found six additional files with a live, non-comment occurrence beyond the ones already known-safe from prior sessions (`attendance.js`, `cashRegister.js`, `parkedCart.js`, `auditLog.js`, `thermalPrinter.js`, `receipt.js`) — every one was individually traced and confirmed dead/safe (either `req.storeId`/a `validateStoreAccess`-covered body field is checked first, or every route using the helper requires `validateStoreAccess`). No new genuine finding was discovered.

**Verdict: 🟢 APPROVED — STOCKOPNAME BLOCKER CLOSED**

---

## 2. Baseline

- Branch: `master`. Commit: `ee10b0760db97a2a3b6449435699ef8fb47c1d9e` (unchanged before/after — no commits performed).
- Working tree at start: 119 items (72 tracked-modified + 47 untracked, including `FINAL_SECURITY_BASELINE_REVIEW.md` from the immediately preceding turn of this same conversation).
- `stockOpname.js` diff at baseline (before this session's fix): 20 lines changed (13 insertions, 7 deletions) — the N-4/N-11 remediation from a prior session (`resolveStoreId` at 6 sites: `getById`, `create`, `update`, `delete`, `changeStatus`, `downloadExcel`; `scalarStoreScope` at `exportSelected`). `uploadExcel`, `checkExists`, `getCompositionItems` were untouched by that prior remediation — this is exactly what left them vulnerable.
- No `git reset`/`stash`/`revert`/`checkout`/`clean` was used. No Phase 1/2/3/C-7/C-9/MED-1/MED-2 file was modified.

---

## 3. Finding SO-01 — uploadExcel

### Root Cause
Line 1143: `let effectiveStore = req.cookies?.store || req.user?.store` — the client-controlled `store` cookie was checked **before** the JWT-derived claim. `cookie-parser` is mounted (`api/index.js:164`) and no route anywhere in the codebase ever calls `res.cookie('store', ...)`, so this cookie is 100% attacker-supplied. `effectiveStore` was then used unmodified as `store:` in `db.stockOpname.create(...)` inside a transaction (line ~1246), so a `POST /stock-opname/upload-excel` request (gated `requireRole('super_admin','admin')`) from a Store A admin carrying `Cookie: store=<Store B>` created a real `stock_opname` draft record — with all uploaded line items — attributed to Store B.

### RED
New suite `__tests__/security-so-stockopname-cookie-tenant-isolation.test.js`, `SO-01 uploadExcel` describe block. The test `'store A admin uploading with Cookie: store=B MUST NOT create a stock_opname for store B'` failed against the pre-fix code: `db.stockOpname.findAll({where:{store: storeB.id}})` returned 1 row (expected 0) — the cookie-forged request had actually created the foreign-store record.

### Fix
```js
// before
let effectiveStore = req.cookies?.store || req.user?.store
// after
let effectiveStore = resolveStoreId(req)
```
`resolveStoreId` (already imported at the top of the file, already used by six sibling functions) resolves to the caller's own pinned store for any non-super-admin (`req.storeId`/`req.user?.store`, never a cookie) and to the legitimate `super_admin` cookie-based store-selector only for `super_admin` — the same "legacy cookie switch" pattern already documented as intentional elsewhere in the codebase (`utils/tenantScope.js`'s own comment). The existing fallback chain (infer store from the uploaded Excel's location column, then first active location) is preserved unchanged for when `resolveStoreId` returns null — which, given N-11's upstream 403 guard for unassigned accounts, is only reachable by a genuinely global `super_admin`, exactly as intended.

### GREEN
`SO-01` block: 6/6 pass, including the RED-proving test.

### Adversarial Test
- `Cookie: store=B` → no Store B row created (RED-proven, now GREEN).
- `Cookie: store=999999` (nonexistent) → no row created under 999999.
- Excel `Lokasi` cell containing the literal text `"SO_STORE_B"` → still attributed to the caller's own store (Store A), not redirected by file content.
- Unassigned admin (no store claim) → `403` before any write (N-11 guard, unaffected by this fix).
- `super_admin` with explicit `?store=` → upload succeeds, correctly attributed.

### DB Verification
Every test in this block queries `db.stockOpname.findAll({where:{store: storeB.id}}))` directly after the request (not just the HTTP response) and asserts zero rows — the database state, not just the API's claimed status code, is the source of truth.

---

## 4. Finding SO-02 — checkExists

### Root Cause
Line 1414-1415: `const cookieStore = req.cookies?.store; const effectiveStore = store || cookieStore` (where `store = req.query.store`). `validateStoreAccess` validates `req.query.store` **when present** (rejecting a mismatched value for non-super-admin with 403), but omitting the query parameter entirely bypassed that validation path and fell through to the raw cookie. Route `GET /stock-opname/check-exists` is gated only `authorization + validateStoreAccess` — no `requireRole`, reachable by any authenticated role including `kasir`.

### RED
`SO-02 checkExists` block, test `'store A user omitting ?store= but sending Cookie: store=B MUST NOT disclose store B state'`: against pre-fix code, `res.body.data.exists` was `true` (the real state of Store B's completed opname), when it must never be disclosed to a Store A caller.

### Fix
```js
// before
const { store } = req.query
const cookieStore = req.cookies?.store
const effectiveStore = store || cookieStore
// after
const effectiveStore = resolveStoreId(req)
```

### GREEN
`SO-02` block: 7/7 pass.

### Adversarial Test
- Own `?store=A` → correct (false) result.
- Explicit foreign `?store=B` → `403` (pre-existing `validateStoreAccess` guard, unaffected).
- Omitted `?store=` + `Cookie: store=B` → no longer discloses Store B's true state (RED-proven, now GREEN).
- Omitted both → resolves to own store or fails closed (400), never silently global.
- Own-store legitimate request (Store B token, `?store=B`) → correctly returns `exists:true`.
- Unassigned user → `403`.
- `super_admin` with explicit `?store=B` → correct result, global access preserved.
- Combination `?store=A` + `Cookie: store=B` → resolves to A (query/`validateStoreAccess` wins, cookie is fully inert).
- Combination `?store=B` + `Cookie: store=A` → still `403` (explicit foreign query still rejected regardless of cookie).
- Empty cookie value (`Cookie: store=`) → never leaks Store B state.

---

## 5. Finding SO-03 — getCompositionItems

### Root Cause
Identical pattern and identical root cause to SO-02, in the sibling function `getCompositionItems` (lines 1450-1451). Route `GET /stock-opname/composition-items`, same middleware (any authenticated role).

### RED
`SO-03` block, test `'store A user omitting ?store= but sending Cookie: store=B MUST NOT leak store B item data'`: against pre-fix code, the response's `data` array contained an item named `SO_SECRET_STORE_B_ITEM` — a canary item created under Store B's completed stock opname, disclosed to a Store A caller via the forged cookie.

### Fix
Same as SO-02: `const effectiveStore = resolveStoreId(req)` replaces the query-then-cookie fallback.

### GREEN
`SO-03` block: 4/4 pass.

### Adversarial Test
- Explicit foreign `?store=B` → `403`.
- Omitted `?store=` + `Cookie: store=B` → canary item name no longer appears in the response (RED-proven, now GREEN) — verified against the **actual returned data**, not just the HTTP status.
- Own-store legitimate request → correctly includes the item.
- Unassigned user → `403`.

---

## 6. Complete stockOpname.js Sweep

| Function | Store Source | Trusted? | Tenant Scoped? | Result |
|---|---|---|---|---|
| `getAll` | `req.storeId` | ✅ | ✅ (`where.store` when present; `super_admin` global otherwise) | Safe — unchanged |
| `getById` | `resolveStoreId(req)` | ✅ | ✅ | Safe — unchanged |
| `create` | `resolveStoreId(req)` → `req.user?.store` → (super_admin-only reachable) `items[0].lokasiId` | ✅ for non-super; low-risk client-input fallback only reachable by an already-unrestricted `super_admin` with no store context | ✅ | Safe — unchanged, not part of this remediation's scope (not a cookie issue, not one of SO-01/02/03) |
| `update` | `resolveStoreId(req)` | ✅ | ✅ | Safe — unchanged |
| `delete` | `resolveStoreId(req)` | ✅ | ✅ | Safe — unchanged |
| `changeStatus` | `resolveStoreId(req)` | ✅ | ✅ | Safe — unchanged |
| `downloadExcel` | `resolveStoreId(req)` | ✅ | ✅ (scopes the location dropdown list only) | Safe — unchanged |
| `uploadExcel` | ~~`req.cookies?.store \|\| req.user?.store`~~ → `resolveStoreId(req)` | ❌→✅ | ❌→✅ | **SO-01 — FIXED** |
| `exportSelected` | `scalarStoreScope(req)` (WHERE-clause level) | ✅ | ✅ | Safe — unchanged (N-4) |
| `checkExists` | ~~`req.query.store \|\| req.cookies?.store`~~ → `resolveStoreId(req)` | ❌→✅ | ❌→✅ | **SO-02 — FIXED** |
| `getCompositionItems` | ~~`req.query.store \|\| req.cookies?.store`~~ → `resolveStoreId(req)` | ❌→✅ | ❌→✅ | **SO-03 — FIXED** |

Every store-reading/writing/querying function in the file was enumerated and classified. All 11 functions are now safe.

---

## 7. Repository Cookie/Store Pattern Sweep

Full repository search for `req.cookies.store`/`req.cookies?.store`/`cookieStore` found 18 files. Classification (A = safe/super_admin-only, B = safe/validated-against-trusted-tenant, C = dead/unreachable, D = vulnerable):

| File | Classification | Note |
|---|---|---|
| `stockOpname.js` | **D → fixed this session** | SO-01/02/03 |
| `inventory.js`, `report.js`, `reporting.js`, `bom.js`, `taxConfig.js`, `productBundle.js`, `purchaseReturn.js` | A/C | Comment-only (already-fixed-elsewhere text describing the old vulnerable pattern) — no live `req.cookies` read remains in any of these |
| `category.js` | A | Live read, but only inside the `roleType === 'super_admin'` branch — the intentional global-store-selector pattern, non-super-admin path uses `authorizedStoreIds` exclusively |
| `purchasePayment.js` | C | `req.storeId || req.cookies.store` — `req.storeId` always truthy for an assigned caller (N-11), cookie unreachable; explicitly documented dead/safe in `SECURITY_REAUDIT_FINAL.md §H`, re-confirmed this session |
| `accounting.js` | C | `getStore()`'s `req.storeId || req.body.storeId || req.body.store || req.query.store || req.cookies.store || ...` — `req.storeId` always truthy first for an assigned caller reaching `POST /accounting/journals`; N-11 blocks unassigned accounts upstream |
| `getReportStore.js` | A | This is the SAFE helper itself — its own comment documents that `req.cookies.store` is deliberately never used |
| `attendance.js` **(newly checked this session)** | C | `getStore()` reads the cookie as a fallback, but is only ever called by `getTodayAttendance`/`getByShift` — both routes require `validateStoreAccess`. The two routes that lack it (`/clock`, `/my`) never call `getStore()` at all |
| `cashRegister.js` **(newly checked this session)** | C | Same `getStore()` shape; verified all 11 routes require `validateStoreAccess` |
| `parkedCart.js` **(newly checked this session)** | C | Same shape, explicitly self-documented as safe in its own code comment; verified all 6 routes require `validateStoreAccess` |
| `auditLog.js` **(newly checked this session)** | C | `req.storeId || req.cookies.store || ...`; both routes require `validateStoreAccess` + `requireRole('super_admin')` |
| `thermalPrinter.js` **(newly checked this session)** | B | `storeId (body) || req.storeId || req.cookies?.store || ...` — `storeId` is `req.body.storeId`, which `validateStoreAccess` itself validates (its `supplied` calculation explicitly checks `req.body.storeId`) before the controller runs; all 4 routes are covered by a router-level `router.use(validateStoreAccess)`. A foreign `storeId` in the body is 403'd at the middleware, so by the time the controller runs `storeId` (if present) already equals the caller's own store |
| `receipt.js` **(newly checked this session)** | C | Single route, `validateStoreAccess` present, `req.storeId` checked first |

**No new genuine finding.** Every occurrence beyond the three fixed ones was individually traced to source code and route configuration (not assumed safe from a pattern match alone) and confirmed either genuinely dead code or protected by `validateStoreAccess`'s own coverage of the relevant client-supplied field.

---

## 8. Test Quality Review

- All 20 new tests use real HTTP (`supertest`) against the real route → `authorization` → `validateStoreAccess` → (`requireRole` where applicable) → controller chain, real PostgreSQL, dynamically-created `Store A`/`Store B` locations, and JWTs signed with claims tied to those dynamically-created ids (`storeA.id`/`storeB.id`, never a hardcoded literal).
- The `uploadExcel` tests build a real `.xlsx` buffer via `exceljs` (the same library the endpoint itself uses to parse), attached via supertest's `.attach()` — not a mocked file, not a mocked `req.file`.
- No test mocks `validateStoreAccess`, `resolveStoreId`, or any ownership check — every assertion exercises the production code path unmodified.
- Write test (`uploadExcel`) verifies actual database state (`db.stockOpname.findAll(...)`) after every request, not merely the HTTP status — satisfying the "a 403 alone is not sufficient for a write test" requirement.
- Read tests (`checkExists`, `getCompositionItems`) verify both the HTTP response body content (`exists`/`data[].name`) and, where relevant, the underlying data (canary item name), not just status codes.
- No existing test was deleted, weakened, or modified to force a pass.

---

## 9. Database Verification

No schema change was made or needed — this is a pure application-layer authorization-source defect (which value feeds the `store` column of a `db.stockOpname.create`/query), not a missing constraint. Every write test queries the `stock_opname` table directly after the request completes to confirm no foreign-store row exists; every read test's canary data was inserted directly via `db.stockOpname.create`/`db.stockOpnameItem.create` (not through the API) so the test independently controls and verifies the ground truth the endpoint must not leak.

---

## 10. Regression Results

| Suite group | Result |
|---|---|
| New SO tests + N-4 + all `stock-` suites + crit/high/medium/N-series/C-series/residual (combined) | 36 suites, 290/290 PASS |
| Tenant-isolation + Phase 2/3 concurrency + backup security (combined) | 31 suites, 481/481 PASS |
| Full regression, run #1 | **90/90 suites, 959/959 tests, PASS (205.6s)** |
| Full regression, run #2 | **90/90 suites, 959/959 tests, PASS (228.1s)** |

(90 = 89 pre-existing + 1 new suite; 959 = 939 pre-existing + 20 new tests.) Two consecutive clean runs. No test was rerun-until-green; no failure occurred in either full run.

---

## 11. Cross-Phase Regression

- **C-7, C-9, MED-1, MED-2:** all four residual-finding suites included in the 36-suite combined run above — 26/26 of their own tests pass unchanged (verifying `location.js`, `member.js`, `type-payment.js`, `supplier.js`, `expenseScheduler.js`, `shiftSwapScheduler.js`, `backup.js` were not touched this session and remain correctly fixed).
- **Phase 1 tenant isolation:** `security-crit*`/`security-high*`/`security-n*`/`tenant-isolation-idor`/`dashboard-tenant-isolation`/`store-isolation` all pass in the two combined runs above.
- **Phase 2 inventory:** `stock-*` suites (which now also include the fixed `stockOpname.js` behavior) pass; `f7-bom`, `goods-receipt`, `purchase-*`, `split-bill` all pass.
- **Phase 3 accounting / AR concurrency:** `accounting-*`, `accounts-receivable-concurrency`, `order-resurrection-rejection`, `order-unique-collision-hardening`, `customer-order-table-lock`, `accounting-provisioning-concurrency` all pass in the combined runs.
- **Order lifecycle:** all `order-*` suites pass.

No regression in any previously-verified area.

---

## 12. Remaining Findings

**0.** SO-01, SO-02, and SO-03 are closed. The repository-wide pattern sweep (§7) found no additional genuine vulnerability. `stockOpname.js`'s `create` function retains a low-risk, `super_admin`-only-reachable client-input fallback (`items[0].lokasiId`) that was out of scope for this remediation (not a cookie issue, not named in the three findings) — noted for completeness, not blocking.

---

## 13. Final Verdict

# 🟢 APPROVED — STOCKOPNAME BLOCKER CLOSED
