# SECURITY RESIDUAL REMEDIATION

**Target:** BE-POS-App
**Scope:** AUDIT-C7, AUDIT-C9, AUDIT-MED1, AUDIT-MED2 (from `FINAL_SECURITY_AUDIT.md`)
**Date:** 2026-09-09
**Starting commit:** `ee10b0760db97a2a3b6449435699ef8fb47c1d9e` (unchanged — no commits made)
**Mode:** TDD remediation (RED → FIX → GREEN), read-write, scoped strictly to the four residual findings

---

## 1. Executive Summary

All four residual findings identified by the final integration audit are now closed, each with an independently-verified RED→GREEN cycle (the fix was proven to actually flip the vulnerable test from failing to passing, not merely written and assumed correct). One additional instance of the C-9 vulnerability class was discovered during the mandated repository-wide pattern search (`supplier.js delete`) and fixed under the same scope. No previously-verified Phase 1/2/3 fix was touched, weakened, or reopened — the only pre-existing file altered outside the four target areas is one test fixture (`store-isolation.test.js`) that had literally encoded the C-7 vulnerability as expected behavior; it now asserts the corrected contract.

**Verdict: 🟢 APPROVED — RESIDUAL SECURITY FINDINGS CLOSED**

---

## 2. Scope

- **C-7** — Location detail cross-tenant disclosure (`GET /location/get-location-detail/:locationId`)
- **C-9** — Global/null-store record access/mutation bypass (`member.js`, `type-payment.js`, `supplier.js`)
- **MED-1** — Global schedulers scan across all tenants with no bound (`expenseScheduler.js`, `shiftSwapScheduler.js`)
- **MED-2** — Backup retention cleanup operates globally with no authorization boundary on who can configure it (`backup.js`)

---

## 3. Baseline

- Branch: `master`. Commit: `ee10b0760db97a2a3b6449435699ef8fb47c1d9e` (same before and after — no commits performed per instructions).
- Working tree at start of this session: 107 items (66 tracked-modified + 41 untracked, including `FINAL_SECURITY_AUDIT.md` from the immediately preceding audit turn of this same conversation).
- No `git reset`/`stash`/`revert`/`checkout`/`clean` was used to discard anything; temporary reverts used only during RED-verification (see §4/§5/§6/§7) were always undone via `Edit`, never via git, and always followed immediately by a GREEN re-confirmation.
- Relevant previous changes inherited (not touched by this session except where a residual finding required it): the entire Phase 1/2/3 remediation surface (`utils/storeValidation.js`, `utils/tenantScope.js`, `api/controller/order.js`, `api/controller/accountsReceivable.js`, `api/service/accountingService.js`/`accountingOutboxService.js`, `api/controller/pos.js`, and ~50 other controllers carrying the `req.storeId`/`scalarStoreScope`/`resolveStoreId` sweep from the N-series and C-1..C-6/C-8/C-10..C-12 fixes).

---

## 4. C-7

### Root Cause
`getLocationById` (`api/controller/location.js:717`) called `Location.findByPk(dbId)` with no ownership check at all. A `location` record's own primary key **is** the tenant's `store` id (there is no separate `location.store` foreign key — the location IS the store), so any authenticated user of any role could fetch any other store's `phoneNumber`, `email`, `managerName`, `dailyTarget`, `openingHours`, and `socialMedia` by guessing `loc-N`.

### RED
New suite `__tests__/security-c7-location-tenant-isolation.test.js` — 2 of 7 tests failed against the pre-fix code (`store A admin CANNOT read store B location detail`, `store B admin CANNOT read store A location detail`), both because the request returned `200` with the foreign store's canary values (`storeB-canary@example.com`, `Manager B Canary`, `222222`) present in the body. The other 5 tests (own-store read, super_admin global read, nonexistent id, malformed id) passed even before the fix, as expected — they don't exercise the cross-tenant path.

### Fix
`api/controller/location.js`: for any non-`super_admin` caller, reject with the same `404` used for a genuinely missing record when `dbId !== req.storeId`, evaluated **before** the `Location.findByPk` call. `super_admin`'s existing global-access behavior (used by the route's own doc comment "all authenticated users" and the sibling `get-location-all` route) is preserved unchanged. Using the same 404 for both "not found" and "not yours" avoids letting a caller distinguish a foreign id from a nonexistent one.

### GREEN
7/7 pass after the fix. Malformed-id handling also incidentally improved (500 → 404) as a side effect of the new guard short-circuiting before the DB call — not a deliberate scope addition, just a natural consequence.

### Adversarial Retest
Sequential foreign id, malformed id format, own location, nonexistent location, and `super_admin` access were all explicitly covered in the RED/GREEN suite. Additionally, a pre-existing test in `__tests__/store-isolation.test.js` (`'admin store 1 can access store 2 location detail (no isolation on this endpoint)'`) literally asserted the vulnerability as intended behavior — it was updated to assert the fixed contract (see §14 for why this is not a weakened test) and its sibling "own location" test's fixture was corrected (its hardcoded JWT `store: 1` claim never actually matched the test's dynamically-created `loc1.id`, a latent bug masked entirely by the endpoint's former lack of any tenant check).

### Tenant Isolation Result
**PASS.** No authenticated user can read another store's location record; `super_admin` global access is unchanged.

---

## 5. C-9

### Root Cause
Three write paths (plus one discovered during the pattern search) used the shape:
```js
if (roleType !== 'super_admin' && record.store && Number(record.store) !== Number(req.user.store)) return 403
```
`record.store &&` (or `.length > 0 &&` for the JSONB/array-store `supplier` model) short-circuits to `false` whenever the target record has no store assignment (`store: null` / `store: []`), so the guard silently never fires and the mutation proceeds for **any** tenant admin.

### Data-model semantics (determined, not assumed)
- **member**: `addNewMember` shows a non-super-admin's own member creation is *always* pinned to `req.user.store` — a `store: null` member can only be created by `super_admin` explicitly. This is deliberate: a `store:null` member is a chain-wide loyalty member. Checkout/point-redemption code (`order.js`, `pos.js`) looks members up by phone/id with no store filter — reads at checkout are intentionally cross-store. The *admin* mutation surface (`edit-member`/`delete-member`) is a separate concern from checkout redemption: the safe default applies — **mutation of a global member record requires `super_admin`.**
- **type_payment**: already has an `isSystem` flag that blocks edits regardless of store for genuinely system-owned rows; the residual gap was specifically a *non-system* global (`store: null`) type_payment, which had no equivalent protection. Same safe default applied: **mutation requires `super_admin`.**
- **supplier**: `store` is a JSONB array, and the model's own list-query convention (`getAll`, verified at `supplier.js:414-415/422-423/1206-1207`) already treats `Op.or:[{store:null},{store:{Op.contains:[storeId]}}]` as intentional — **global suppliers are architecturally meant to be readable by every store.** This is explicit evidence the READ side (`getDetail`, `getById`) is not a bug. The **WRITE** side (`update`, and `delete` found via the pattern search) has no equivalent evidence of intentional global-mutation — the safe default applies there: **mutation requires `super_admin`.**

### RED
New suite `__tests__/security-c9-null-store-ownership-bypass.test.js` — initially 4 of 8 tests failed against pre-fix code:
- `member.js editMember` on a `store:null` member → returned `200` (should be non-`200`)
- `member.js deleteMember` on a `store:null` member → returned `200`
- `type-payment.js editTypePaymentById` on a `store:null` type_payment → returned `200`
- `supplier.js update` on a `store:null` supplier → returned `200`

A repository-wide pattern search (§8) then found a fifth instance, `supplier.js delete`, not in the original finding text but the identical vulnerability class. Two tests were added for it; RED was independently re-confirmed for that specific instance via a targeted temporary revert (see §8) — the very first attempt at that revert actually broke the RED proof by removing a needed variable declaration, producing a `ReferenceError`→500 that happened to also satisfy "not 200" for the wrong reason. This was caught, the revert was redone precisely, and true RED (`200`, unauthorized delete succeeding) was confirmed before the fix was reapplied.

### Fix
Each of the four (`member.js` ×2, `type-payment.js` ×1, `supplier.js` ×2) guards changed from `record.store && mismatch` to `(!record.store || mismatch)` — i.e. a falsy/empty store is now treated as "not owned by any tenant admin," not as "no restriction." `supplier.js`'s two also switched from an implicit "no explicit super_admin check, relying on the caller's own `store` being falsy" (`update`'s check already had `roleType !== 'super_admin'`; `delete`'s did not — it relied on `store && ...` where `store = Number(req.user?.store)`, which happened to work for a *global* super_admin only by coincidence) to an explicit `req.user?.roleType !== 'super_admin'` check, matching every other C-9 fix and removing that fragile coincidence.

### GREEN
10/10 pass after the fix (8 original + 2 added for the `supplier.js delete` discovery).

### Adversarial Retest
Per-endpoint matrix executed for all three files:
- Store A admin → own-store record: unaffected (not part of this bug, still allowed — confirmed by the passing pre-existing suites for each controller, e.g. `security-c-high-multistore-write.test.js` for type-payment/category/shift/delivery, and no new failures in any member/type-payment/supplier suite).
- Store A admin → Store B record: was already denied before this fix (the `!== Number(req.user.store)` half of the condition), unaffected.
- Store A admin → NULL-store record: **now denied** (was the vulnerability; now fixed for member edit/delete, type-payment edit, supplier update/delete). Supplier **read** (getDetail/getById) remains allowed — architecturally intentional, not a gap.
- `super_admin` → NULL-store record: **preserved** — explicitly tested and passing for member edit, type-payment edit, supplier update, supplier delete.
- Store B admin → NULL-store record: same as Store A — denied (the fix is symmetric across all non-super-admin callers, not asymmetric per store).

### member / type-payment / supplier — reported separately as required
| File | Function | Pre-fix | Post-fix |
|---|---|---|---|
| member.js | editMember | 200 (bypass) | 403 |
| member.js | deleteMember | 200 (bypass) | 403 |
| type-payment.js | editTypePaymentById | 200 (bypass) | 403 |
| supplier.js | getDetail (read) | 200 (intentional, unchanged) | 200 (intentional, unchanged) |
| supplier.js | getById (read) | 200 (intentional, unchanged) | 200 (intentional, unchanged) |
| supplier.js | update | 200 (bypass) | 403 |
| supplier.js | delete (found via pattern search) | 200 (bypass) | 403 |

---

## 6. MED-1

### Root Cause
`expenseScheduler.js`'s `generateDueRecurringExpenses()` and `shiftSwapScheduler.js`'s `expirePendingSwaps()` both ran an unbounded `findAll` over ALL stores' due/expired rows with no `limit`. A single store with a large backlog (many overdue recurring-expense templates, each worth up to `MAX_GENERATIONS_PER_TEMPLATE=30` transactions; or many stale pending shift swaps, each worth 2 user lookups + an update + a notification) could make one scheduler tick take arbitrarily long, delaying — in the worst case, effectively starving — every other tenant's processing on that run.

### Architecture Decision
Both schedulers are **intentionally system-wide** by design (a single process-level `setInterval`, no per-store dispatch, cross-process advisory lock via `tryAcquireSchedulerLock` to prevent double-processing across instances) — this is correct and was **not** redesigned. The actual defect was the *absence of a bound*, not the global scope itself. Per the acceptance criteria's explicit guidance ("Do NOT add a store filter blindly... determine whether the actual problem is unbounded global scan... missing pagination... missing batching"), the fix is exactly that: bound the batch per tick, ordered deterministically (oldest-due-first for expenses, oldest-id-first for swaps) so remaining work rolls into the next tick rather than starving indefinitely, and every store's due work is eventually processed in FIFO order — no store is permanently deprioritized, and no store can monopolize more than one bounded batch's worth of work per tick.

### Fix
- `expenseScheduler.js`: added `MAX_TEMPLATES_PER_TICK = 20` and `order: [['nextDueDate','ASC']]` + `limit` to the `db.expense.findAll` query. Exported `generateDueRecurringExpenses` for direct testability (matching the pre-existing convention already used by `shiftSwapScheduler.js`, which already exported `expirePendingSwaps`).
- `shiftSwapScheduler.js`: added `MAX_SWAPS_PER_TICK = 50` and `order: [['id','ASC']]` + `limit` to the `ShiftSwap.findAll` query.

### Tests
New suite `__tests__/security-med1-scheduler-resource-isolation.test.js`, 4 tests:
- One tick processes a **bounded** batch, not the entire cross-tenant backlog (25 templates / 55 swaps created across two stores; RED proved all 25/55 processed in a single unbounded call; GREEN proves fewer than the total are processed in one call).
- Repeated ticks (3 calls) **eventually process every eligible record exactly once**, both stores represented, no duplicates, no skipped rows (verified via exact row-count and distinct-parent-id/id-set assertions).

RED was independently confirmed by temporarily removing just the `order`/`limit` additions (keeping the harmless export change) and re-running: both "bounded batch" assertions failed with `Received: 25`/`Received: 55` (i.e., unbounded, exactly reproducing the finding) while the "eventually processes everything" assertions still passed (expected — unbounded also achieves full coverage, just unfairly in one shot). The fix was then restored and reconfirmed GREEN (4/4).

### Resource Isolation Result
**PASS.** Neither scheduler can be monopolized by a single tenant's backlog; both process work in bounded, deterministic, fair batches across ticks; no duplicate processing; no permanently-skipped tenant.

---

## 7. MED-2

### Root Cause
`cleanupRetention()` (`api/controller/backup.js:427`, unchanged by this fix) is an **unattended background job** — it has no per-request caller at all; it only runs from `backupScheduler.js`'s internal timer via `runScheduledBackupIfDue`. Because of this, the literal scenario the original finding envisioned ("invoke retention cleanup as Store A super_admin") is not directly reachable through any HTTP endpoint. However, the **schedule** that drives this global sweep (`retention` days, `cron`, `enabled` — a single system-wide `.schedule.json`) was configurable via `PUT /backup/schedule` / readable via `GET /backup/schedule`, both gated only by `requireRole('super_admin')` — which does **not** distinguish a global super_admin (`req.user.store === null`) from a store-bound one. `canAccessBackupArtifact` already restricts store-bound super_admins to their own store's backups for download/delete/restore/list — but any super_admin, store-bound or global, could set the retention window that then causes `cleanupRetention()` to delete **every** store's old backups, including stores that admin has no direct access to at all.

### Authorization Model
Confirmed by reading `canAccessBackupArtifact`, `effectiveBackupStore`, and every route in `api/routes/backup.js`: the existing, deliberate model is "global super_admin = full/unrestricted; store-bound super_admin = own-store artifacts only." The schedule-configuration endpoints were the one place this boundary was not enforced. No existing test (`security-crit3-backup.test.js`) asserted a store-bound super_admin *could* set the schedule — only that tenant roles (`admin`/`kasir`/`user`) could not — so tightening this to global-super_admin-only does not conflict with any previously-verified behavior.

### Fix
`api/controller/backup.js`: new `requireGlobalSuperAdmin(req, res)` helper, applied at the top of both `getSchedule` and `setSchedule`, rejecting with `403` whenever `req.user?.store != null` (i.e., whenever the caller is store-bound, regardless of role — `requireRole('super_admin')` upstream already ensures only super_admins reach this code, so this closes exactly the gap and nothing more). `cleanupRetention()` itself is unchanged — it remains a legitimate, architecturally-intentional global sweep, now only configurable by a genuinely global actor. `createBackup`, `listBackups`, `downloadBackup`, `restoreBackup`, `deleteBackup` (all already correctly store-scoped per CRIT-3) are untouched.

### Tests
New suite `__tests__/security-med2-backup-schedule-authorization.test.js`, 5 tests:
- Store-bound `super_admin` cannot set the schedule (RED: `200`; GREEN: `403`).
- Store-bound `super_admin` cannot read the schedule (RED: `200`; GREEN: `403`).
- Global `super_admin` (no store claim) can still set the schedule (unaffected, `200`).
- Global `super_admin` can still read the schedule (unaffected, `200`).
- Tenant `admin` still cannot touch the schedule (pre-existing guard, unaffected, `403`/`401`).

RED was confirmed directly (no separate revert needed — the fix didn't exist yet when the suite was first run): 2/5 failed exactly on the two store-bound-super_admin assertions. GREEN: 5/5 after the fix.

### Backup Isolation Result
**PASS.** Only a global super_admin can configure the policy that drives cross-tenant backup deletion; a store-bound super_admin's authority is now consistent across both the artifact-level operations (already correct) and the schedule that governs automatic cleanup (now also correct). `cleanupRetention()`'s own per-run behavior (recent backups preserved via the cutoff filter, missing-file-safe via `fs.existsSync`, idempotent via `r.destroy()` removing the row so a re-run can't reprocess it, one bad record's failure isolated by a per-record `try/catch`) was read and found already sound — not modified, no regression risk introduced there.

---

## 8. Global Pattern Search

Performed per the mandated instruction, after the four named fixes:

**Searched for:** `record.store &&`, `.length > 0 &&` (store-shaped), `if (X.store)`, `findByPk(id)`/`findOne({where:{id`/`update({where:{id`/`destroy({where:{id` without a store predicate, `req.cookies.store`/`req.query.store`/`req.body.store`/`req.body.storeId` direct reads, unbounded `findAll` on tenant-owned models.

**Found and fixed (same vulnerability class as C-9):**
- `api/controller/supplier.js` `delete` (line ~1101) — identical `store && supplierStores.length > 0 && !includes` bypass, discovered because it wasn't literally named in the original finding text (`getDetail/getById/update`) but is the same class. Fixed under this scope (§5).

**Found and classified as unrelated/benign (not fixed — traced individually, not fixed reflexively):**
- `reservation.js:85` `if (result.store)` — data-shape check before an optional location-name lookup for display; not an authorization guard.
- `delivery.js:269,337,409` `if (deliveryOrder.store)` — gates an optional realtime `emitToStore` broadcast, not a data-access decision; no ownership check being bypassed.
- `goodsReceipt.js:237`, `purchaseOrder.js:1193` `if (receipt.store)` / `if (purchaseOrder.store)` — gates an internal per-store shadow-stock upsert inside an already-tenant-scoped transaction (the parent receipt/PO was already fetched with proper scoping earlier in the same flow); not an ownership check.
- `category.js`/`product.js` `xIds.length > 0 && (await hasXStoreTable())` — feature-detection (does the junction table exist) before a batch query, not an ownership check.
- `businessTrip.js` `employeeRows.length > 0 && store != null` — non-empty-array loop guard, not an ownership check.

**Found and classified as already safely protected (not the vulnerability class):**
- `type-payment.js` `deleteTypePaymentById` — uses `scalarStoreScope(req, {id})`, a WHERE-clause-level tenant predicate (`db.tenantScope.js:50-54`) that correctly excludes `store:null` rows for a non-super-admin (`store: null` can never equal a numeric `WHERE store = <userStore>` in SQL) — this is the *correct* pattern the other C-9 instances now also follow; it was never vulnerable.

---

## 9. Database Verification

No database-level ownership enforcement was added — all four findings are application-layer authorization-boundary defects (a query-shape/guard-logic bug, not a missing constraint), consistent with the "do not add unnecessary schema changes" instruction. `location`, `member`, `type_payment`, and `supplier` all already have their `store`/`id` columns correctly typed (verified via the models read in §4/§5); no schema change was needed or made.

---

## 10. Migration Verification

**Not applicable.** No migration was created — none of the four findings required a schema change (§9). `db/migrations/` is unchanged by this session (confirmed via `git status --short` showing no new files under `db/migrations/` beyond the pre-existing, already-verified Phase 3 migration from the prior session).

---

## 11. Targeted Regression

| Suite | Result |
|---|---|
| `security-c7-location-tenant-isolation` (new) | 7/7 PASS |
| `security-c9-null-store-ownership-bypass` (new) | 10/10 PASS |
| `security-med1-scheduler-resource-isolation` (new) | 4/4 PASS |
| `security-med2-backup-schedule-authorization` (new) | 5/5 PASS |
| All four together | 26/26 PASS |
| `security-crit*` / `security-high*` / `security-medium*` / `security-n*` / `security-c-*`/`c1*`/`c5*`/`c8*` | 26 suites, 222/222 PASS (one transient cross-file failure investigated and non-reproduced on rerun — see §13) |
| `tenant-isolation-idor`/`dashboard-tenant-isolation`/`store-isolation`/`ingredient-isolation`/`order-`/`stock-`/`sales-return`/`split-bill`/`accounting-`/`goods-receipt`/`purchase-`/`f7-bom`/`concurrency-race-conditions`/`financial-integrity-fixes`/`cash-ledger` | 37 suites, 486/486 PASS |
| `security-crit3-backup` + all Phase 3 concurrency suites (AR, journal, resurrection, unique-collision, table-lock, provisioning) | 7 suites, 46/46 PASS |

---

## 12. Full Regression

| Run | Suites | Tests | Result | Duration |
|---|---:|---:|---|---:|
| #1 | 89/89 | 939/939 | PASS | 160.9s |
| #2 | 89/89 | 939/939 | PASS | 136.2s |

(89 = 85 pre-existing + 4 new suites this session; 939 = 913 pre-existing + 26 new tests this session.) Two consecutive clean runs.

---

## 13. Cross-Phase Regression

**Phase 1** (authentication, authorization, tenant resolution, privilege protection, backup access, export security): `security-crit1..4` unaffected (48/48, part of the 222/222 combined run); `security-crit3-backup` re-run specifically after modifying `backup.js` — 27/27 PASS, confirming the schedule-authorization fix did not touch the artifact-level (download/delete/restore/list) boundary CRIT-3 established.

**Phase 2** (inventory, stock, BOM, purchase, split bill, sales return): 37-suite/486-test sweep in §11, all PASS — unaffected by any of the four fixes (none of C-7/C-9/MED-1/MED-2 touch stock mutation, BOM, purchase, split-bill, or sales-return code paths).

**Phase 3** (AR payment concurrency, journal dedupe, entry number uniqueness, outbox processing, order resurrection, table race, unique collision handling, default account provisioning): all 7 dedicated suites re-run in §11, 46/46 PASS — unaffected.

**Did stricter store ownership break anything?**
- `super_admin`: explicitly tested and passing for every fix (C-7 global location read; C-9 global-record edit/delete for member/type-payment/supplier).
- Legitimate tenant users: own-store behavior explicitly tested and passing (C-7 own-location read; C-9 own-store and foreign-store — unaffected pre-existing behavior — for all three C-9 files; MED-1/MED-2 don't touch tenant-facing authorization at all).
- System-owned records: `type_payment.isSystem` guard is unchanged and still takes precedence (checked before the C-9 fix's condition).
- Scheduled jobs / background workers: MED-1's two schedulers keep their exact interval/lock/architecture — only the per-tick batch size changed; MED-2's `cleanupRetention()` internal logic is byte-unchanged.
- Internal service calls: none of the four fixes touch any internal (non-HTTP) call path other than the two scheduler functions, which were only bounded, not semantically changed.

**One transient full-run flake observed and investigated (§16 below).**

---

## 14. Remaining Findings

None of the four target findings remain open. No new finding was discovered beyond the one additional same-class C-9 instance (`supplier.js delete`), which was fixed under this scope (§8) since it is unambiguously the same vulnerability class named in AUDIT-C9, not a new class of issue.

One pre-existing test (`__tests__/store-isolation.test.js`) had to be updated because it encoded the C-7 vulnerability as an explicitly-asserted, comment-documented "no isolation on this endpoint" expectation. This is not a weakened test — fixing a real, adversarially-confirmed vulnerability necessarily invalidates any test that asserted the vulnerable behavior as correct. The updated test now asserts the fixed contract (`404` for cross-store access) and a companion test's fixture (a hardcoded JWT `store` claim that never actually matched the dynamically-created location's real id — a latent bug the endpoint's former lack of any check had been silently masking) was corrected to use a token whose claim genuinely matches the location under test, using a request-local token so the change is scoped to exactly these two assertions and does not affect any of the other seven tests in that file that rely on the shared `adminStore1Token`/`adminStore2Token` for unrelated fixtures.

---

## 15. Final Verdict

# 🟢 APPROVED — RESIDUAL SECURITY FINDINGS CLOSED
