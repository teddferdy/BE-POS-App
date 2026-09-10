# SECURITY_PHASE3_AUDIT.md — Business Logic & Data Integrity

**Target:** `BE-POS-App` (Node.js / Express / PostgreSQL POS backend)
**Repository root:** `/Users/teddyferdianabraramrullah/fullstack-dev/POS-APP/BE-POS-App`
**Audit date:** 2026-09-09
**Audit commit:** `ee10b0760db97a2a3b6449435699ef8fb47c1d9e` (branch `master`)
**Audit mode:** READ-ONLY. No production code, test, configuration, or migration file was modified by this audit. Adversarial experiments were executed with temporary scripts located **outside** the repository under `/var/folders/dp/w1r2pvrx5l18v4b0978gdrj00000gn/T/opencode/`, and all rows created were destroyed afterward. The ONLY file this audit adds is this report.
**Scope (Phase 3):** business-logic and data-integrity invariants for an ALREADY-AUTHORIZED user — double-payment, lost updates, invalid state transitions, duplicate accounting entries, overselling, replay, refund-above-paid. Authorization/tenant isolation (Phases 1–2) is out of scope and was previously APPROVED; this report assesses whether an authorized `super_admin`/`admin` (or any user reaching a business mutation route) can drive the system into an invalid financial/inventory/accounting state.

---

## 1. Executive Summary

The codebase is **exceptionally well hardened** on the paths the existing regression suite covers: stock deduction is row-locked and re-validated under the lock (`SELECT … FOR UPDATE` + atomic `GREATEST(stock−qty,0)` + a `stock >= 0` CHECK), order idempotency is backed by a partial unique index, split-bill completion and sales-return approval/cancellation are serialized by `FOR UPDATE` row locks, and the accounting outbox makes journal enqueues durable inside the caller transaction. **All 894 existing tests pass; all three security tiers pass; two clean full-regression runs were observed.**

**However, the audit's adversarial experiments — run against the same test database the suite uses — confirmed three business-logic defects that the existing test suite does not cover. Two are CRITICAL (financial/accounting corruption); one is MEDIUM (invalid state transition with a stock/cash mismatch).** The verdict is therefore **NOT APPROVED**.

---

## 2. Confirmed Findings Summary

| ID | Severity | Confirmed | Title | Source | Evidence |
|----|----------|-----------|-------|--------|----------|
| F-01 | **CRITICAL** | YES (5/5 repro) | `accountsReceivable.recordPayment` lost-update race — two concurrent payments both succeed; 2 payment rows written, `paidAmount` loses an update, `outstandingAmount`/`status` stay wrong | `api/controller/accountsReceivable.js:236,248,256,271` | Two concurrent 600 payments against 1000 AR → both HTTP 201, `ar_payment` count = 2, final `paidAmount = 600`, `outstandingAmount = 400`, `status = PARTIAL`. Sequential control: 201 then 400 (guard works). See §5.1 |
| F-02 | **CRITICAL** | YES | Accounting journal double-posting + duplicate `entryNumber` — non-atomic dedupe, `nextSeq = MAX(id)+1` race, no DB unique constraints | `api/service/accountingService.js:173-188,220-241`; `api/service/accountingOutboxService.js:76-92` | Two concurrent `postOrderJournal` for the same `(store, order, referenceId)` → 2 `journal_entry` rows (revenue + cash double-counted), both with entryNumber `JV-<store>-000001`; 6 lines instead of 3. Schema verified to have no unique index on `(store,sourceType,referenceId)` nor on `entryNumber`. See §5.2 |
| F-03 | **MEDIUM** | YES | Invalid `updateOrderStatus` transition cancelled/refunded → paid re-deducts stock with **zero net cash** | `api/controller/order.js:2417-2437` | createOrder paid (stock 10→9, +111) → cancel (stock→10, −111, `paymentStatus='refunded'`) → mark paid again (HTTP 200; stock→9; ledger net = 0). See §5.3 |
| F-04 | LOW | Code review | Key-less `createOrder`/`createCustomerOrder` duplicates possible; unique-collision catch can echo a wrong existing order | `api/controller/order.js:876-885,1128-1137` | Idempotency relies on client-supplied optional key; no key ⇒ no protection. Catch treats every `SequelizeUniqueConstraintError` as idempotency replay. See §5.4 |
| F-05 | LOW | Code review | `createCustomerOrder` table-status check is unlocked (duplicate QR bookings for one table) | `api/controller/order.js:2894-2904` | Table row read without `FOR UPDATE`; two concurrent submits with different keys can both book. No stock/payment impact until paid. See §5.5 |
| F-06 | LOW | Code review | `createJournalEntry` "never throws / returns null" contract + `attemptJob` without a transaction can silently drop an entry while marking the outbox row posted | `api/service/accountingService.js:245-249`; `api/service/accountingOutboxService.js:87,94-99,131-137` | A transient DB error inside `createJournalEntry` returns `null`; `attemptJob` then reports `ok:true` and the row is `markPosted` — entry never retried. See §5.6 |
| F-07 | INFO | Code review | `salesReturn.approve` / return creation not wrapped in `withDeadlockRetry` | `api/controller/salesReturn.js:136`, `api/controller/pos.js:1020` | Deadlock surfaces as 500 (no corruption); locking order is consistent. See §5.7 |
| F-08 | INFO | Code review | `ensureDefaultAccounts` / `findOrCreateAccount` non-atomic on first-ever posting for a store | `api/service/accountingService.js:150-166,304-343` | Two concurrent first posts can both try to create account `(store,code)`; one gets `SequelizeUniqueConstraintError` (recoverable via outbox retry). See §5.8 |

---

## 3. Audit Metadata

- **Auditor constraints honored**: read-only; no source/test/config edits; no fixes; no migrations; experiments only outside the repository; only this file added.
- **Pre-existing working-tree state** (NOT produced by this audit): 63 modified files + 31 untracked files (Phase 2 remediation code + Phase 1/2 security test files + Phase 1/2 audit reports). Left untouched.
- **Test database:** `cashier_app_test` @ 127.0.0.1:5432 (cloned schema from `cashier_app`, truncated by `scripts/setup-test-db.js` at every jest run).
- **Environment:** macOS, Node.js, PostgreSQL; JWT secret from test env.

---

## 4. Architecture & Transaction Map

### 4.1 Stock mutation (single authoritative path)
- `api/service/stockMutationService.js` — the only helper through which stock deltas are applied. Requires a caller-supplied transaction, locks the product row first, uses atomic SQL deltas, `floorAtZero` by default.
- POS checkout `createOrder` (`api/controller/order.js:846`): one transaction (`:991-1088`) via `withDeadlockRetry` — order, order items, `deductStockForOrder` (locks all distinct products via `findAll({ lock: t.LOCK.UPDATE })`, re-validates availability **under** the lock, `GREATEST(stock−qty,0)`), `recordOrderPayment`, initial status, loyalty, promo usage, outbox enqueue. Transactional outbox adopted for order journal + COGS.
- QR pay-later `createCustomerOrder` (`:2822`): no stock deduction at creation; server re-derives every price from DB (`:2971-2996`); deduction deferred to the paid transition.
- `updateOrderStatus` paid/cancel/void (`:2137-2583`): **row-locked re-read** (`lockedOrder`, `:2362`) inside the transaction; a concurrent double-mark-paid can no longer double-deduct (this specific race was previously fixed and is regression-tested — `concurrency-race-conditions.test.js`).
- Split-bill (`api/controller/splitBill.js`): single unconditional `FOR UPDATE` on the parent order first, then all split rows; completion invariant rechecked under the locks; `deductStockForPaidOrder` runs exactly once guarded by `order.paymentStatus !== 'paid'`. Sound.
- Sales return (`api/controller/salesReturn.js`, `api/controller/pos.js`): return row + order row both `FOR UPDATE`; refund ceiling computed from the ledger; double-approval and approve-vs-cancel both serialized and mutual-exclusive (verified + regression-tested in `sales-return-hardening.test.js`). Sound.
- Production-order BOM ingredient deduction (F7): ingredients deducted via immutable `stock_history` snapshots and reversed from the same snapshot, never re-exploding current BOM (verified in `f7-bom-ingredient-deduction.test.js`).
- **Bonus: the "resurrect" gap at `:2434-2437` is the only stock/cash mismatch found in the order state machine** (F-03).

### 4.2 Accounting / outbox
- `enqueueAccountingJob` (`api/service/accountingOutboxService.js:52-71`) inserts the `accounting_outbox` row **inside** the caller's business transaction — durable.
- `attemptJob` (`:76-92`) posts the actual journal **after** the business commit, **without its own transaction**, and `markPosted`/`recordImmediateAttempt` update the outbox row nontransactionally.
- `createJournalEntry` (`accountingService.js:192-249`): balances lines; dedupes by `(store, sourceType, referenceId)` with a plain `findOne` (not atomic); assigns `entryNumber = makeEntryNumber(store, MAX(id)+1)`.
- **The dedupe non-atomicity + MAX(id)+1 + no unique constraints are the root of F-02.** The outbox row can be processed concurrently by the request handler's immediate post-commit attempt and the 30-second scheduler drain (`accountingOutboxScheduler.js:9-38`, which selects `status='pending'` rows with **no locking/SKIP LOCKED**).

### 4.3 Accounts receivable (NOT part of the stock accounting path)
- Route `POST /accounts-receivable/:id/pay` → `authorization → validateStoreAccess → requireRole('super_admin','admin') → recordPayment` (`api/routes/accountsReceivable.js:29-35`); **no body schema validation**; only a manual `amount > 0` check.
- `recordPayment` reads the AR row with **no lock** before the transaction opens, applies the over-payment guard to the stale in-memory value, then in a fresh transaction inserts `ar_payment` and blindly sets `paidAmount = stale + amount` (F-01). AR is **not** journaled into the general ledger (fire-and-forget gap noted in prior phases); here the balance sheet object itself is corrupted under concurrency.

---

## 5. Detailed Findings

### 5.1 F-01 — CRITICAL: AR `recordPayment` lost-update race (double collection, ledger corruption)

**Source** — `api/controller/accountsReceivable.js`:

```js
236:  const ar = await db.accounts_receivable.findOne({ where })          // READ — no lock
248:  if (Number(ar.paidAmount) + Number(amount) > Number(ar.totalAmount)) // GUARD uses stale value
256:  const t = await db.sequelize.transaction()                          // transaction opens AFTER guard
271:  const newPaidAmount = Number(ar.paidAmount) + Number(amount)        // stale read → WRITE
275:  await ar.update({ paidAmount: newPaidAmount, outstandingAmount: newOutstanding, status: newStatus },
       { transaction: t })
```

**Why it fails:** both requests read `paidAmount = 0` (no `FOR UPDATE`), both pass the guard (`0+600 ≤ 1000`), both insert an `ar_payment` row and both write `paidAmount = 0 + 600 = 600`. The second write is a lost update; the money is collected twice but recorded once.

**Reproduction (2×600 concurrent against a 1000 AR; `POST /accounts-receivable/:id/pay`, admin in store):**

```
Run 1: [HTTP 201, HTTP 201]  paymentRows=2(1200 collected)  paidAmount=600  outstanding=400  status=PARTIAL   *** VULNERABLE ***
Run 2: same                                                                    *** VULNERABLE ***
Run 3: same                                                                    *** VULNERABLE ***
Run 4: same                                                                    *** VULNERABLE ***
Run 5: same                                                                    *** VULNERABLE ***
Sequential control: first 600 → 201; second 600 → 400 (over-payment guard works when not concurrent)
```

**Impact:** two payments accepted where only 1.2× the balance was owed; `received = 1200` but ledger shows `paid 600 / outstanding 400`. Customer is shown to still owe money they already paid. Double collection, unreconcilable ledger, wrong `status`; direct financial-integrity violation. Reproducible deterministically (5/5).

**Coverage gap:** the suite has no test for concurrent AR payments (only tenant ownership: `security-high8-ar-order-ownership.test.js`).

**Fix direction:** read the AR with `findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })` and evaluate the guard from the locked value; apply `paidAmount` via SQL arithmetic (`paidAmount + $1`) guarded by `WHERE outstandingAmount >= $1`; add idempotency (unique key per payment attempt) as backstop.

---

### 5.2 F-02 — CRITICAL: Journal double-posting + duplicate `entryNumber`

**Source** — `api/service/accountingService.js`:

```js
173: async function nextSeq(store, transaction) {
174:   const last = await db.journal_entry.findOne({ where: { store }, order: [['id','DESC']] })
180:   return (last?.id || 0) + 1                       // MAX(id)+1 — concurrent → duplicate numbers
183: async function existingEntry(store, sourceType, referenceId) {
184:   return db.journal_entry.findOne({ where: { store, sourceType, referenceId } })
220:   const dup = await existingEntry(...)             // SELECT … then INSERT (no lock, no unique index)
223:   const seq = await nextSeq(store, transaction)
```

`attemptJob` (`accountingOutboxService.js:76-92`) calls `postOrderJournal(...)` with **no transaction**, so the dedupe SELECT (line 220) and the INSERT (line 224) are separate auto-commit statements, and the outbox row itself is drained without `FOR UPDATE`/`SKIP LOCKED`. The 30s scheduler can therefore process the same still-`pending` row in the same instant the request handler's immediate post-commit attempt does. Additionally, the live schema (verified in `scripts/dev-schema.sql`) has **no unique constraint** on `journal_entry.entryNumber` nor on `(store, sourceType, referenceId)` — only the PK and a non-unique `(store, date)` index.

**Reproduction (two concurrent `postOrderJournal` for the same `(store, order, referenceId)`):**

```
r1 entryNumber: JV-9440-000001  id: 21495  totalDebit 1110
r2 entryNumber: JV-9440-000001  id: 21496  totalDebit 1110      ← SAME referenceId, SAME entryNumber
Total journal_entry rows for (store,'order',999001): 2          ← double-posted
Total journal_entry_line rows: 6                                ← 3 lines posted twice
*** DOUBLE-POST CONFIRMED *** / *** DUPLICATE entryNumber CONFIRMED ***
```

**Impact:** the general ledger may count the same sale (or the same COGS/AR/expense) twice — revenue and cash inflated; voucher numbers collide, destroying the audit trail. The duplicate-`entryNumber` variant is also reachable with **different** orders: two cashiers checking out concurrently in the same store both compute `MAX(id)+1` and mint the same next number.

**Coverage gap:** `accounting-journal-flow.test.js` tests only the manual `/accounting/journals` endpoint; `financial-integrity-fixes.test.js` tests outbox retry/durability but **not** concurrent double-processing or entryNumber uniqueness.

**Fix direction:** unique index `journal_entry (store, sourceType, referenceId)`; unique index `journal_entry (store, entryNumber)`; replace `MAX(id)+1` with a real per-store sequence or a `counter` table updated via `INSERT … ON CONFLICT DO UPDATE RETURNING`; make journal posting transactional (dedupe + write in one tx) and drain with `FOR UPDATE SKIP LOCKED`.

---

### 5.3 F-03 — MEDIUM: `updateOrderStatus` cancelled/refunded → paid "resurrection" re-deducts stock with zero net cash

**Source** — `api/controller/order.js`:

```js
2417: if (status === 'paid' && oldStatus !== 'paid') {       // no check that oldStatus is cancellable-from
2418:   const existingTxn = await db.transaction.findOne({ where: { order: id }, transaction: t })
2422:   if (!existingTxn) { ...create payment ledger... }       // resurrect: ledger row already exists → NOT re-created
2434:   if (oldPaymentStatus !== 'paid') {                      // 'refunded' !== 'paid' → true
2435:     await deductPaidOrderStock(t)                          // stock deducted a SECOND time
```

Only the `oldStatus !== 'paid'` gate exists; a cancelled order (`paymentStatus = 'refunded'`, stock already reversed and a refund booked at `:2471-2482`) satisfies it, so marking it `paid` again re-deducts stock while the ledger net balance is already **0**.

**Reproduction (admin; product stock starts at 10):**

```
createOrder(paid):   stock 10 → 9 ; ledger +111 ; status=paid  paymentStatus=paid
cancel:              stock  9 → 10; ledger −111 (net 0); status=cancelled paymentStatus=refunded
mark paid again:     HTTP 200     ; stock 10 → 9 ; ledger net still 0 ; status=paid paymentStatus=paid
*** FLAW CONFIRMED: cancelled/refunded order marked paid again re-deducts stock with ZERO new payment (net ledger 0) ***
```

**Impact:** inventory leaves the shelf with no corresponding cash; the order's financial record (net 0) contradicts its stock effect. A canceled-and-refunded order can be repeatedly cycled to drain stock without money changing hands.

**Coverage gap:** no test exercises `cancelled → paid`; `order-cancel-flow.test.js` and the status-race tests cover only `pending→paid`/`paid→cancelled`.

**Fix direction:** enforce an explicit allowed-transition set (e.g., reject any transition **into** `paid` from `cancelled`/`void`; require a fresh payment to be physically recorded before restoring `paid`).

---

### 5.4 F-04 — LOW: Key-less order creation is duplicate-prone; catch can return a wrong order

`order.js:876-885` checks idempotency only if the client sends a key; the partial unique index `(store, idempotencyKey)` (`db/migrations/20260903000004-order-idempotency-and-daily-counter.js:12-16`) protects only keyed requests. A client that retries after a timeout **without** a key creates two orders, two payment rows, and double stock deduction. Additionally, `:1128-1137` treats **any** `SequelizeUniqueConstraintError` during `Order.create` as an idempotency replay — including a rare `orderNumber` collision — in which case it returns an unrelated existing order as an HTTP 200 replay. Verified by code review; no exploit script (design-level behavior).

---

### 5.5 F-05 — LOW: `createCustomerOrder` table-status race

`order.js:2894-2904` checks `table.status` without locking the table row; two concurrent QR submits (distinct idempotency keys) can both pass and create two bookings for the same table. Stock is untouched until the paid transition, so impact is duplicate-orders/liveness, not financial.

---

### 5.6 F-06 — LOW: `createJournalEntry` null-on-error can mark lost entries as posted

`accountingService.js:245-249` swallows any posting error and returns `null`; `postOrderJournal` then also returns `null` (no throw); `attemptJob` (`accountingOutboxService.js:87`) sees *no exception* and returns `{ ok: true }`; `recordImmediateAttempt` → `markPosted`. A transient insert error inside `createJournalEntry` therefore **permanently** removes the entry from the retry queue. (Contrast: the account-creation race F-08 *does* throw and is retried — the inconsistency is that some failures throw and are retried while others silently become "posted".)

---

### 5.7 F-07 — INFO: return approve/create lack `withDeadlockRetry`

`salesReturn.js:136` and `pos.js:1020` open raw transactions without the deadlock-retry wrapper used elsewhere. Lock orderings are consistent (return→order; order→…), so a deadlock is unlikely and non-corrupting (a 500 surfaces, nothing commits). Defense-in-depth suggestion.

---

### 5.8 F-08 — INFO: first-ever account provisioning race

`ensureDefaultAccounts` (`accountingService.js:150-166`) uses count-then-create without a transaction, and `findOrCreateAccount` (`:304-343`) can collide on the `(store, code)` unique key for the very first order of a store. One concurrent request gets `SequelizeUniqueConstraintError` → caught by `attemptJob` → marked failed → scheduler retries → resolved. No corruption; transient first-posting latency.

---

## 6. Invariants Assessed

| ID | Invariant | Result |
|----|-----------|--------|
| INV-001 | `AR.paidAmount + AR.outstandingAmount === AR.totalAmount` | **VIOLATED (F-01)** — final state 600 / 400 / total 1000 is fine, but received money (1200) ≠ `paidAmount` (600); the invariant that fails is INV-002 |
| INV-002 | `Σ ar_payment.amount === AR.paidAmount` | **VIOLATED (F-01)** — 2 rows × 600 = 1200 ≠ 600 |
| INV-003 | Over-collection never recorded | **VIOLATED (F-01)** — 1200 collected on a 1000 debt |
| INV-004 | At most one journal entry per `(store, sourceType, referenceId)` | **VIOLATED (F-02)** |
| INV-005 | `journal_entry.entryNumber` unique per store | **VIOLATED (F-02)** |
| INV-006 | Journal balanced (`totalDebit === totalCredit`) | **Preserved** (all posted entries balanced) |
| INV-007 | Stock deducted exactly once per paid order; reversed exactly once per cancel | **Preserved under concurrency** (row-locked `lockedOrder`); **VIOLATED via F-03** (second deduction on resurrect) |
| INV-008 | A paid order is backed by net positive cash on its ledger | **VIOLATED (F-03)** — ledger net 0 while stock is deducted |
| INV-009 | No cancelled/refunded order may return to a value-earning status without a new payment | **VIOLATED (F-03)** |
| INV-010 | No overselling (product stock never below 0; reserved stock respected) | **Preserved** — locked product rows + under-lock recheck + `stock >= 0` CHECK; regression-covered |
| INV-011 | Keyed idempotent replay never duplicates an order | **Preserved** — partial unique index `(store, idempotencyKey)` |
| INV-012 | Split-bill completion deducts stock once and only when all splits are covered | **Preserved** — order-first `FOR UPDATE` + in-tx invariant; regression-covered |
| INV-013 | A sales return cannot be approved twice; refund never exceeds collected−refunded−reserved | **Preserved** — return + order row locks, ledger-based ceiling; regression-covered |
| INV-014 | Loyalty redemption / promo usage are atomic (no negative balance / no cap breach) | **Preserved** — regression-covered (`financial-integrity-fixes.test.js`) |

**Confirmed breakages: INV-002, INV-003, INV-004, INV-005, INV-007, INV-008, INV-009.**

---

## 7. Regression & Test Evidence

All runs executed in the repo with `NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --runInBand --no-cache` (test DB truncated automatically by `scripts/setup-test-db.js` at each run).

### 7.1 Security suites (Phase 1/2 regression)
| Suite | Result |
|-------|--------|
| `--testPathPatterns='security-crit'` | 4/4 suites, 48/48 tests — PASS |
| `--testPathPatterns='security-high'` | 10/10 suites, 74/74 tests — PASS |
| `--testPathPatterns='security-medium'` | 1/1 suites, 19/19 tests — PASS |

### 7.2 Business-critical suites (Phase 3 relevant)
`--testPathPatterns='concurrency-race-conditions|f7-bom|sales-return|stock-|order-|split-bill|accounting-|cash-ledger|goods-receipt|purchase-'` → **27/27 suites, 272/272 tests — PASS** (46.3s).

### 7.3 Full regression (required twice)
| Run | Result | Duration |
|-----|--------|----------|
| Run #1 | 79/79 suites, 894/894 tests — PASS | 165.99s |
| Run #2 (first attempt) | **4 suites, 54 tests FAIL** — flaky, environmental | 355.74s |
| Run #3 | 79/79 suites, 894/894 tests — PASS | (re-run) |
| Run #4 (confirmatory) | 79/79 suites, 894/894 tests — PASS | 259.50s |

**On Run #2:** the first attempt was **aborted by the operator** mid-execution; the immediately following full run then failed 54 tests. Because `setup-test-db` truncates every table at the start of every jest invocation, the failures cannot be DB-state contamination from the abort — this was transient environment/resource flakiness (the run also took >2× normal wall time, consistent with resource contention from the aborted process). Three subsequent clean full runs (runs #1, #3, #4) confirm the suite is stable: **two+ clean full-regression passes observed**.

### 7.4 Adversarial experiments (outside repo; cleaned up)
- `ar-race-test.js` / `ar-race-repeat.js` (F-01) — 5/5 vulnerable + sequential control.
- `ar-sequential.js` (F-01 control) — 201 then 400.
- `resurrect-test.js` (F-03) — stock 10→9→10→9, ledger net 0.
- `jv-race-test.js` (F-02) — duplicate entry + duplicate entryNumber.

All created rows (`location`, `product`, `order`, `account`, `journal_entry`, `journal_entry_line`, `ar_payment`, `accounts_receivable`, `category`) were destroyed at the end of each script. Repo `git status` after the audit shows the same 63 modified + 31 untracked files that predated the audit; no auditor files inside the repo except this report.

---

## 8. Test-Suite Quality Assessment

**Strengths** (genuinely cover their claims — all confirmed by independent code review):
- Oversell race (`concurrency-race-conditions.test.js`) — real HTTP + real DB, asserts exact `[201, 400]` outcome and exact stock.
- Keyed-order replay (`customer-order-idempotency-concurrency.test.js`) — unique index enforced.
- `updateOrderStatus` double stock-deduction regression.
- Split-bill completion, sales-return double-approval + approve-vs-cancel, loyalty/promo atomicity, outbox durability/retry.

**Gaps** (matching exactly the confirmed findings):
- **No test sends concurrent `POST /accounts-receivable/:id/pay`** (F-01).
- **No test runs two concurrent journal posts for the same reference, and none asserts `entryNumber` uniqueness** (F-02).
- **No test attempts `cancelled/refunded → paid`** (F-03).
- No test for key-less double-submit (F-04) or table-status race (F-05).

The 894-test green suite therefore **does not imply** the financial invariants hold; the confirmed defects live entirely in the uncovered region.

---

## 9. False-Positive Analysis (candidates examined and cleared)

| Candidate | Where checked | Verdict |
|-----------|---------------|---------|
| Concurrent checkout overselling | `deductStockForOrder` product `FOR UPDATE` + under-lock recheck + `stock>=0` CHECK; regression-covered | CLEARED |
| Double stock deduction on concurrent `paid`/`cancelled` status taps | Row-locked `lockedOrder` re-read (`order.js:2362`) | CLEARED |
| Split-bill final-payment double-trigger | Order-first `FOR UPDATE` + `paymentStatus !== 'paid'` guard in-tx | CLEARED |
| Sales-return double-approval / approve-vs-cancel | Return + order `FOR UPDATE`, ledger ceiling, mutual-exclusion status checks | CLEARED |
| Refund-above-collected | `totalCollected − totalRefunded − reserved` at create; re-check under lock at approve | CLEARED |
| BOM ingredient reversal drift | Reversal uses immutable `stock_history` snapshot, not current BOM | CLEARED |
| Loyalty negative balance / promo over-use | Atomic in-order-transaction updates with guards; regression-covered | CLEARED |
| `stockMutationService.floorAtZero` masking oversell | Intended floor (soft-hold), overarching `stock>=0` CHECK remains | CLEARED |
| Journal entry **imbalance** | Compute never inserts unbalanced headers; trial-balance test passes | CLEARED |
| AR duplicate/nonexistent **payment** via different tenant | Route middleware chain prevents cross-tenant AR ids (Phase 2) | CLEARED (out of Phase 3 scope, confirmed intact) |

---

## 10. Remaining Risks After This Audit

1. **F-01** — every concurrent app of two payments to one AR reproduces the lost update; a busy credit-sale store will hit it in normal operation.
2. **F-02** — duplicate journal/entryNumber collisions scale with store concurrency; the request-handler-vs-scheduler window is narrow but the cross-order entryNumber collision is routine at a busy store.
3. **F-03** — requires an authorized actor to intentionally (or via a buggy client) re-mark a cancelled order paid; damages inventory and order provenance.
4. **F-04/F-05** — client-contract issues; impact depends on client behavior.
5. **F-06** — the "never-throws" accounting contract can hide transient post failures; undetectable at runtime except by reconciliation.

---

## 11. Recommended Remediation Order

1. **F-01 (CRITICAL)** — lock AR row (`FOR UPDATE`) inside the transaction, evaluate the guard from the locked value, apply increments with conditional SQL (`WHERE outstandingAmount >= $1`); add a per-payment idempotency key.
2. **F-02 (CRITICAL)** — DB unique indexes (`(store, sourceType, referenceId)` and `(store, entryNumber)`); per-store atomic counter for `entryNumber`; transactional dedupe+insert; drain with `FOR UPDATE SKIP LOCKED`. Re-run full regression + dedicated concurrency tests.
3. **F-03 (MEDIUM)** — explicit order state machine (forbid `cancelled/void/refunded → paid`); require a real payment ledger row for any re-`paid`; add regression test.
4. **F-06 (LOW)** — make posting failures throw (or return an explicit status the outbox can mark retryable) so `null` ≠ success.
5. **F-04 (LOW)** — document/require idempotency keys on all order-creation routes; narrow the unique-collision catch to the idempotency index only (distinguish error constraint name).
6. **F-05 / F-07 / F-08** — table-row lock in `createCustomerOrder`; wrap return operations in `withDeadlockRetry`; provision default accounts under `ON CONFLICT DO NOTHING`.

---

## 12. Final Verdict

## 🔴 NOT APPROVED

Phase 3 (Business Logic & Data Integrity) is **NOT APPROVED**.

- **F-01 (CRITICAL)** — AR payment lost-update is deterministically reproducible (5/5): two authorized-role payments to the same AR are both accepted, two payment rows are written while `paidAmount` records only one and `outstandingAmount`/`status` stay wrong. INV-002/INV-003 broken.
- **F-02 (CRITICAL)** — journal double-posting and duplicate `entryNumber` confirmed: the same business event can be booked twice into the general ledger and voucher numbers collide. INV-004/INV-005 broken.
- **F-03 (MEDIUM)** — `cancelled/refunded → paid` resurrects an order with no cash; stock crosses the counter while the ledger is net-zero. INV-007/INV-008/INV-009 broken.

All 894 repository tests pass and the three security tiers pass (two+ clean full-regression runs recorded), but none of the confirmed defects is covered by the suite. Until F-01, F-02 and F-03 are remediated and regression-tested, an authorized user can place the POS into invalid financial and inventory states.

---

*Generated 2026-09-09 by an independent adversarial auditor. Read-only; no repository file besides this report was created or modified.*