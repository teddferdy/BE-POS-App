# PHASE 22 — BATCH 8 — EXPENSE DURABLE ACCOUNTING OUTBOX — IMPLEMENTATION REPORT

## A. Verdict

**PASS — ONE REMEDIATION CAPABILITY IMPLEMENTED**

Expense accounting journal synchronization (F22-B5-03) is now durable, transactional, retryable, and stale-event-safe, using the Batch 7-approved Option C (state reconciliation) design. All 8 real call sites were re-audited from current code (not assumed from the Batch 7 report) and wired through one new, additive outbox job type, `expense_journal_sync`. One additional, narrowly-scoped concurrency fix was required and made — see Section L.

## B. Baseline

- BE HEAD before work: `cc160c3` (unchanged throughout — no commits made)
- FE HEAD: `637da9a4`, clean, untouched (no FE changes — none required or made)
- Branch: `master`
- Working tree before work: Batch 6 (`purchaseReturn.js` + its test + report) and Batch 7 (design doc) local, uncommitted, untouched by this batch — confirmed byte-identical before/after via `git diff api/controller/purchaseReturn.js`

## C. Finding (F22-B5-03, re-proven from current code)

Re-audited all 8 call sites fresh:

| # | Call site | Mutation | Transaction (before) | Journal call (before) |
|---|---|---|---|---|
| 1 | `create()` | `db.expense.create()` | None | `syncExpenseJournal`, fire-and-forget, only if `status==='approved'` |
| 2 | `bulkCreate()` | `db.expense.create()` × N | Yes, own | `syncExpenseJournal` per approved record, **after** commit |
| 3 | `update()` | `expense.update()` | None | `syncExpenseJournal`, unconditional, fire-and-forget |
| 4 | `approve()` | `expense.update({status:'approved'})` | None | `syncExpenseJournal`, fire-and-forget |
| 5 | `reject()` | `expense.update({status:'rejected'})` | None | `deleteExpenseJournal` directly, fire-and-forget |
| 6 | `setActive()` | `expense.update({isActive})` | None | `syncExpenseJournal`, fire-and-forget |
| 7 | `delete()` | `expense.destroy()` (paranoid soft-delete) | None | `deleteExpenseJournal` directly, fire-and-forget |
| 8 | `generateSalary()` | `db.expense.create()` × N | Yes, own | `syncExpenseJournal(payload, {transaction})` — **confirmed broken**: the function takes one object argument; the second `{transaction}` argument is silently ignored, so the write actually ran in its own separate transaction despite the visible intent |

`markPaid()` and `markUnpaid()` re-confirmed via `grep` to have zero journal interaction — untouched, as expected.

## D. Design Implemented (Option C — state reconciliation, per Batch 7)

- **Job type**: `expense_journal_sync` (new, additive registration in `JOB_HANDLERS` — one line, `api/service/accountingOutboxService.js`).
- **Payload**: `{ expenseId }` only — no accounting fields.
- **Handler**: `syncExpenseJournalFromState({ expenseId, transaction })` (new, additive function in `api/service/accountingService.js`) — loads the expense with `paranoid: false` (so it can see a soft-deleted row and correctly route it to journal removal, rather than silently no-op'ing because the default paranoid scope hides it), then:
  - if `expense.deletedAt` is set → calls the existing, unmodified `deleteExpenseJournal`
  - otherwise → calls the existing, unmodified `syncExpenseJournal` with every field re-derived from the live row (`store`, `amount`, `status`, `isActive`, category name/account code via the `categoryData` include, etc.)
- **Transaction boundary**: `enqueueAccountingJob(..., transaction: t)` is called inside the same `db.sequelize.transaction()` as the expense mutation, at every one of the 8 call sites (introducing a transaction where none existed before, at 6 of them — see Section E).
- **Post-commit behavior**: identical to Batches 5/6 — `attemptJob` + `recordImmediateAttempt` after commit; failure leaves the row `pending` for the scheduler, never rolls back the already-committed expense mutation.

## E. Call Sites (all 8, all in `api/controller/expense.js`)

1. **`create()`** — wrapped `db.expense.create()` in `db.sequelize.transaction()`; enqueues only when the resolved status is `'approved'` (mirrors the original conditional exactly).
2. **`bulkCreate()`** — enqueue moved from the post-commit loop to inside the existing per-record creation loop (still inside the same transaction); post-commit loop now runs `attemptJob`/`recordImmediateAttempt` per collected job instead of calling `syncExpenseJournal` directly.
3. **`update()`** — wrapped `expense.update()` in a new transaction; unconditional enqueue (matches the original unconditional `syncExpenseJournal` call). The manual `categoryRow` lookup that used to live in the controller was removed — the worker resolves category itself from the live row, so the controller no longer needs it at all.
4. **`approve()`** — wrapped `expense.update({status:'approved'})` + enqueue in one transaction; removed the controller's manual category lookup for the same reason.
5. **`reject()`** — wrapped `expense.update({status:'rejected'})` + enqueue in one transaction. Replaced the direct `deleteExpenseJournal` call with the same `expense_journal_sync` job type every other mutation uses — the worker re-reads live status and routes to the delete branch itself, so there is still only one job type, no operation-specific variant.
6. **`setActive()`** — wrapped `expense.update({isActive})` + enqueue in one transaction; removed the manual category lookup.
7. **`delete()`** — wrapped `expense.destroy()` (still paranoid soft-delete) + enqueue in one transaction. This is the call site that specifically exercises `syncExpenseJournalFromState`'s `paranoid:false` + `deletedAt` handling.
8. **`generateSalary()`** — replaced the broken two-argument `syncExpenseJournal(payload, {transaction})` call with `enqueueAccountingJob({..., transaction})` inside the existing per-employee loop (still inside the function's existing outer transaction), collecting jobs and attempting them after commit. This incidentally *resolves* the broken transaction-passing as a side effect of using the outbox's correctly-typed `enqueueAccountingJob(..., transaction)` signature — not treated as a separate fix, since it's the exact same mechanical transformation applied to this call site.

These 8 edits (one file, one mechanical pattern repeated) plus two small additive functions constitute the single remediation capability, consistent with the precedent already set by Batch 5 (2 call sites) and Batch 6 (1 call site).

## F. TDD

**RED** — `__tests__/expense-accounting-outbox.test.js` written first (16 tests), run against unmodified `expense.js`/`accountingService.js`/`accountingOutboxService.js`:
```
Tests: 15 failed, 1 passed, 16 total
```
14 failures were `Unknown accounting outbox jobType: expense_journal_sync` (job type not yet registered) or zero-outbox-rows assertions (no call site enqueued anything yet) — exactly the expected shape. One store-isolation test also failed pre-fix as expected.

**GREEN** (after the Section E/D changes):
```
Tests: 16 passed, 16 total
```
(One of those 16 required the Section L concurrency fix to pass — see below; without it, 15/16 passed and the concurrent-workers test specifically failed with duplicated journal lines.)

**Regression**:
```
npx jest __tests__/expense-accounting-outbox.test.js __tests__/purchase-return-accounting-outbox.test.js \
  __tests__/purchase-return-reject-flow.test.js __tests__/purchase-return-reject-uom-reversal.test.js \
  __tests__/purchase-return-uom-conversion.test.js __tests__/goods-receipt-accounting-outbox.test.js \
  __tests__/goods-receipt-cost-formula.test.js __tests__/goods-receipt-ingredient-identity.test.js \
  __tests__/goods-receipt-reversal-flow.test.js __tests__/goods-receipt-cost-concurrency.test.js \
  __tests__/accounting-journal-flow.test.js __tests__/accounting-journal-concurrency.test.js \
  __tests__/accounting-provisioning-concurrency.test.js __tests__/financial-integrity-fixes.test.js \
  __tests__/purchase-payment-flow.test.js __tests__/order-resurrection-rejection.test.js \
  __tests__/split-bill-hardening.test.js __tests__/ap-reminder-service.test.js \
  __tests__/business-date-timezone.test.js __tests__/purchase-order-flow.test.js \
  __tests__/purchase-order-tax.test.js --testPathIgnorePatterns='.claude/worktrees' --runInBand
  → Test Suites: 21 passed, 21 total
  → Tests:       145 passed, 145 total

npx jest __tests__/security-med1-scheduler-resource-isolation.test.js __tests__/cash-ledger-hardening.test.js \
  --testPathIgnorePatterns='.claude/worktrees' --runInBand
  → Test Suites: 2 passed, 2 total
  → Tests:       61 passed, 61 total   (the only other test files touching expense endpoints)

npx eslint api/ utils/ --max-warnings 0
  → exit 0 (matches CI's .github/workflows/ci.yml lint step exactly)
```

## G. Stale Event Safety (proof)

Test: *"stale-event safety: replaying an older sync job after a newer update was already processed does not revert the journal"*. Sequence: approve an expense (amount 5000, journal posted) → enqueue a job representing event A (amount will later change, but the payload carries no amount — only `{expenseId}`) → perform a REAL later update through the durable path (event B, amount → 9000, journal correctly shows 9000) → process the STALE event A directly via `attemptJob`. Result: journal still shows 9000 — the stale job re-read the *live* expense (still 9000 at processing time) and reconciled to that, not to any captured snapshot of the amount at enqueue time. This works by construction: `expense_journal_sync`'s payload never carries `amount`, `status`, or any other accounting field — only the reference id — so there is no stale value to replay in the first place.

## H. Delete Race Safety (proof)

Test: *"update-then-delete race: replaying a stale update job after a later reject was already processed does not resurrect the journal"*. Sequence: approve an expense (journal exists) → enqueue a stale job representing event A → reject the expense through the real durable path (event B; journal correctly removed) → process the stale event A directly. Result: journal remains absent — the stale job re-read the live expense (status: `rejected`) and `syncExpenseJournal`'s own dispatcher (`status==='approved' && isActive!==false` → false) routed to `deleteExpenseJournal`, which is a safe no-op when nothing exists. No resurrection.

## I. Idempotency

- **Duplicate/replay** (*"a second, independently-crafted job... replays the existing journal instead of duplicating it"*): a second job for an already-posted expense reconciles to the same journal row (`journals[0].id === journalBefore[0].id`) — unchanged `createJournalEntry` dedupe via `(store, sourceType, referenceId)` + the real DB partial unique index.
- **Re-drain** (*"re-draining after an expense job already posted does not create a duplicate journal entry"*): confirmed, one journal after two extra `drainAccountingOutbox` passes.
- **Delete retry/replay** (*"delete reconciliation is safe to retry/replay"*): replaying a delete-reconciliation after the journal is already gone is a safe no-op — `deleteExpenseJournal`'s own `if (!existing) return null` guard, unchanged.
- **Immediate-attempt failure → durable retry** (*"an expense_journal_sync job whose immediate attempt fails stays pending and is recovered by the drain function"*): see the important nuance in Section L's sibling note below — `syncExpenseJournal` has its own `if (!store || !expenseId) return null` guard, so the `store: null` corruption trick used in Batches 5/6 resolves to a safe no-op here rather than a throw. The real, reproducible failure trigger used instead: soft-delete the category's underlying `account` row (paranoid, but its `(store, code)` unique index is *not* partial-on-`deletedAt`), forcing a fresh `findOrCreateAccount` attempt to collide with the still-indexed deleted row and throw `SequelizeUniqueConstraintError` — the same class of failure a transient DB blip would produce. First attempt fails and stays `pending`; after repairing the account, `drainAccountingOutbox` recovers it to `posted`.

## J. Store Isolation

Test: *"store isolation: a store A expense only creates outbox/journal rows scoped to store A"* — full two-store fixture (mirrors Batch 6's pattern): Store B's expense creates exactly one outbox row and one journal, both scoped to `storeB.id`, never `location.id` (Store A); an explicit cross-store query (`store: location.id` + Store B's `referenceId`) returns zero rows.

## K. Accounting Policy

**No accounting policy was changed.** `syncExpenseJournal`, `updateExpenseJournal`'s rewrite computation (debit/credit amounts, account codes, descriptions), `postExpenseJournal`, and `deleteExpenseJournal` are functionally unchanged — the only edit inside `updateExpenseJournal` is the concurrency lock described in Section L, which changes *when* the existing rewrite logic is allowed to run, not *what* it computes. `syncExpenseJournalFromState` is purely additive and calls these functions with the exact same field derivation the controller used to do inline (category name/account code, amount, payment method, status, isActive) — just read from the live row instead of values threaded through the request.

## L. Concurrent Rewrite Gap

**Fixed — required, not deferred.** Batch 7 flagged `updateExpenseJournal`'s rewrite step as a *potential* pre-existing gap (no row lock during destroy+recreate of journal lines) and explicitly said not to fix it unless TDD proved the approved design couldn't be safely implemented without it. The concurrent-workers test (*"concurrent reconciliation workers for the same expense converge to one correct journal, not a corrupted or duplicated one"*) proved exactly that: two `attemptJob` calls racing via `Promise.all` for the same expense produced **4** journal lines instead of 2 — a real, reachable correctness failure now that Expense goes through the durable outbox (two jobs for the same reference genuinely can be claimed and processed concurrently, e.g. an immediate attempt racing a scheduler tick after two rapid mutations). This directly falls inside this batch's own required Failure Matrix ("Concurrent workers → One correct final journal"), so per Batch 8's own Step 13 rule, fixing it was required, not optional.

**The fix, minimal and scoped to exactly this gap**: inside `updateExpenseJournal`'s `rewrite(t)`, the journal_entry row is re-fetched with `lock: t.LOCK.UPDATE` (the exact same idiom already used in `batchService.js`, `stockMutationService.js`, `promoUsageService.js`, and `loyaltyService.js` — not a new locking system) before the destroy+recreate. This serializes two concurrent rewrites for the same journal: the second blocks until the first commits, then re-reads the now-current row and cleanly replaces its lines. Verified stable across 3 repeated runs of the concurrent-workers test (no flakiness). Nothing else in `updateExpenseJournal`, `deleteExpenseJournal`, `postExpenseJournal`, or `createJournalEntry` was touched.

## M. Deferred

- **F22-B4-01** — Vercel scheduler runtime gap. Not touched.
- **Purchase Tax accounting treatment** (F22-B2-01) — not touched.
- **Purchase Return tax behavior** — not touched.
- **CBD, CAD, tenor auto due-date policy** — not touched.
- **External notification providers** — not touched.
- **Two newly-discovered, independent, unrelated Expense bugs** (confirmed via reproducible RED evidence, explicitly NOT fixed — fixing either would be a second, unrelated production change):
  1. `updateExpenseSchema` (`createExpenseSchema.partial()`) still carries the base schema's `.default('pending')` on `status` — a `PUT /expense/edit/:id` request that omits `status` gets `'pending'` injected by Zod validation, so the controller's `status: status || expense.status` silently resets an approved expense's status back to `'pending'` on any update that doesn't explicitly re-specify it. Pre-existing, independent of F22-B5-03.
  2. `generateSalary()`'s `amount: emp.monthlySalary` passes a `DECIMAL(15,2)` value — which Sequelize/pg always round-trips as a numeric string with 2 decimal places (e.g. `"4000000.00"`) — directly into `expense.amount` (an `INTEGER` column) with no conversion, causing `POST /expense/generate-salary` to fail with `SequelizeDatabaseError: invalid input syntax for type integer` for any employee that actually has a `monthlySalary` set. This means the endpoint's real-world success path is already non-functional today, independent of this batch. Confirmed via `git diff` that the line is byte-for-byte untouched by this batch. This blocked end-to-end HTTP testing of `generateSalary()`'s new durable-enqueue behavior on the success path (see Section F/test file comments) — what *was* provable and tested is that the whole operation (category creation, expense creation, and the new outbox enqueue) remains one atomic transaction, so this pre-existing failure rolls all three back together with no orphaned expense or outbox row.

Nothing above was silently folded into this batch's scope.
