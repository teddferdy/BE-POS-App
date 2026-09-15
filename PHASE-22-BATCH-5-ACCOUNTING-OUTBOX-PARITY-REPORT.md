# PHASE 22 — BATCH 5 — ACCOUNTING OUTBOX PARITY AUDIT + TDD + ONE-FIX

## A. Verdict

**PASS — ONE PRODUCTION FIX IMPLEMENTED**

Goods Receipt journal posting was fire-and-forget (F22-B1-01, re-confirmed from current code, not assumed). It has been wired through the existing accounting outbox, matching the durable pattern already used by Order, Sales Return, and Purchase Payment. Purchase Return and Expense remain fire-and-forget — confirmed still accurate, deliberately **not** fixed (single-fix limit) — and are carried forward as deferred findings.

## B. Baseline

- BE `master` HEAD: `9f903a544e773e5354f98adf9c8c381758399188` (verified before and after work — unchanged aside from the one intended file diff).
- FE `master` HEAD: `637da9a488335283b84722879527fa2159bba2f4`, working tree clean. **No FE changes made or required** — see Section L.
- Protected file `__tests__/goods-receipt-cost-concurrency.test.js`: present, untracked, unmodified throughout (verified via `git status --short` at start and end).

## C. Architecture Summary — what guarantees exactly one correct journal entry?

Two independent mechanisms compose to give the guarantee, and both predate this batch:

1. **Durable outbox** (`api/service/accountingOutboxService.js`): a caller inserts an `accounting_outbox` row *inside its own business transaction* (`enqueueAccountingJob(..., transaction)`), so the row's existence is exactly as durable as the business event it's attached to — a plain `INSERT` cannot fail independently the way a multi-table accounting post can. After commit, the caller makes one immediate best-effort attempt (`attemptJob` + `recordImmediateAttempt`); on failure the row is left `pending` for `accountingOutboxScheduler.js`'s periodic `drainAccountingOutbox` to retry (bounded at `MAX_ATTEMPTS = 5`, escalating to Sentry + `console.error` once exhausted — never silently dropped).
2. **DB-level idempotent replay** (`createJournalEntry` in `accountingService.js`): every posting function funnels through this single writer, which dedupes by `(store, sourceType, referenceId)` — first via a `SELECT` after acquiring the store's entry-number lock, then via the real partial unique index `journal_entry_store_sourceType_referenceId` (migration `20260909000001-phase3-accounting-integrity.js`) as a final backstop. A retried job that already posted finds and returns the existing entry instead of duplicating it. `drainAccountingOutbox`'s claim query uses `FOR UPDATE SKIP LOCKED`, so two concurrent drains (an immediate attempt racing a scheduler tick, or two scheduler instances) never double-claim the same row — duplicate *processing* is additionally made harmless by (2) regardless.

**`JOB_HANDLERS`** in `accountingOutboxService.js` already registered all nine job types — including `purchase_journal`, `purchase_return_journal`, `expense_journal` — before this batch. A handler being *registered* does not mean it is ever *enqueued*: that is exactly the gap this audit chased down per flow.

The file's own top-of-file comment (authored during the Phase 21 remediation that built this outbox) already lists "goods receipt" among the flows the pattern was meant to close — it was never actually wired for GR, Purchase Return, or Expense. This confirms the gap is a genuine omission relative to the system's own documented intent, not a deliberate design choice — supporting evidence that closing it does not require inventing new accounting policy.

## D. Flow Matrix (post-fix state)

| Flow | Business Transaction | Accounting Event | Durable Outbox | Retry | Idempotent | Failure Can Lose Journal? |
|---|---|---|---|---|---|---|
| **Sales** (Order) | `order.js` create/checkout, own transaction | `postOrderJournal` + `postOrderCogsJournal`, `reverseOrderJournals` | **YES** — enqueued inside the order transaction | YES — scheduler drain, `MAX_ATTEMPTS=5` | YES — unique index + replay | **NO** |
| **Goods Receipt** *(fixed this batch)* | `goodsReceipt.js` create-and-complete / status→completed, own transaction | `postPurchaseJournal` | **YES (was NO)** — enqueued inside the GR transaction | YES (was NO) | YES — same shared `createJournalEntry` | **NO (was YES)** |
| **Purchase Return** *(unfixed — deferred)* | `purchaseReturn.js` approve, own transaction | `postPurchaseReturnJournal` | **NO** | **NO** | N/A — nothing ever retries | **YES** |
| **Expense** *(unfixed — deferred)* | `expense.js` add/edit/approve/markPaid/delete/generate-salary (8 call sites) | `syncExpenseJournal` → `updateExpenseJournal` / `deleteExpenseJournal` (create/update/delete-reactive, not a pure "post once" call) | **NO** | **NO** | N/A | **YES** |

Reference points confirmed already durable before this batch (not touched): **Purchase Payment** (`purchasePayment.js`, `purchase_payment_journal`) and **Sales Return** (`salesReturn.js`, `sales_return_journal`) both already call `enqueueAccountingJob`. This refines Batch 1's original framing ("Sales is durable, the rest is not") — the actual durable set going into this batch was {Order, Sales Return, Purchase Payment}, not just Sales.

## E. Findings

| ID | Severity | Module | Root Cause | Evidence | Impact | Remediation | Fixed? |
|---|---|---|---|---|---|---|---|
| F22-B5-01 | P1 | Goods Receipt | `postPurchaseJournal` called directly after `transaction.commit()`, wrapped in `try { } catch (e) { console.error(...) }`, at both GR completion call sites (`goodsReceipt.js` create-and-complete and status→completed) | `git diff` (this batch) shows the exact prior code; `createJournalEntry`'s own comment (`accountingService.js:246-256`, added in the Phase 21 remediation commit `8061d4f8`) states genuine DB failures now **throw** instead of returning null — a throw here was caught and only logged, never retried | A transient DB failure (pool exhaustion, deadlock, brief network blip) during journal posting permanently loses the accounting entry for a real, already-committed stock receipt — inventory and AP silently diverge, discoverable only by manual reconciliation | Route through the existing accounting outbox: `enqueueAccountingJob` inside the GR transaction, `attemptJob` + `recordImmediateAttempt` after commit — identical to the already-proven `purchasePayment.js` pattern. Zero new infrastructure; `purchase_journal` was already a registered job type. | **YES** |
| F22-B5-02 | P2 | Purchase Return | `postPurchaseReturnJournal` called directly after `t.commit()` (`purchaseReturn.js:449-467`), same fire-and-forget shape as F22-B5-01 | `grep -n "enqueueAccountingJob"` returns zero matches in `purchaseReturn.js`; call site read in full | Same failure mode as F22-B5-01: a genuine posting failure permanently loses the return's AP/inventory reversal entry | Same pattern as this batch's GR fix — wire through `enqueueAccountingJob` using the already-registered `purchase_return_journal` job type | **NO — deferred** (single-fix limit; no accounting-policy decision blocks this, it is a strong Batch 6 candidate) |
| F22-B5-03 | P2 | Expense | `syncExpenseJournal` called directly at 8 call sites across add/edit/approve/markPaid/delete/generate-salary, all fire-and-forget | `grep -n "enqueueAccountingJob"` returns zero matches in `expense.js`; `syncExpenseJournal`'s dispatcher body read in full (`accountingService.js:1025-1043`) | Same loss-on-failure risk as F22-B5-01/02, but the fix shape is materially different: `syncExpenseJournal` is a create/update/**delete**-reactive dispatcher (posts, rewrites in place, or deletes the journal depending on expense status), not a single idempotent "post once" call — the existing outbox `JOB_HANDLERS` contract (one enqueue → one `attemptJob` → one handler call) does not cleanly express "delete the existing journal" as a job. Wiring this correctly needs its own design pass, not a mechanical copy of the GR fix. | Design a durable path for the create/update/delete cases (may need either three job types or a payload discriminator) — explicitly a separate, larger unit of work | **NO — deferred**, and deliberately **not** treated as "the same fix" as F22-B5-01/02 — attempting it inside this batch's one-fix budget would have meant guessing at outbox semantics that don't exist yet, which is exactly the kind of invention this batch is instructed to avoid |
| F22-B2-01 (carried forward, not re-opened) | — | Goods Receipt | `postPurchaseJournal` computes AP credit from `Σ(costPrice × qtyReceived)` prorated only by PO discount — it never reads `purchase_order.taxAmount` (Batch 2's Purchase Tax field) | `accountingService.js:512-564`, unchanged by this batch | GR journals do not reflect purchase tax in the AP figure | **Not remediated — explicitly out of scope.** This is an accounting-policy decision (how tax should appear in the ledger), not a reliability defect; the prompt explicitly forbids inventing purchase-tax accounting treatment in this batch. | **NO — deferred to a dedicated Purchase Tax accounting-treatment batch** |

## F. TDD Evidence

**RED** — `__tests__/goods-receipt-accounting-outbox.test.js` written first, run against unmodified `master` (`9f903a5`):

```
Tests:       3 failed, 1 passed, 4 total
```
Failures were exactly the expected shape — `accounting_outbox` had **zero** rows for `referenceType: 'goods_receipt'` after a completed GR (both call sites), because no code path ever enqueued one. The 4th test (the standalone `purchase_journal` retry-mechanism proof, which exercises `attemptJob` directly and doesn't depend on GR's code) passed even pre-fix, confirming the *registered handler* was never the problem — only the *never-enqueued* call sites were.

**Smallest fix** — `api/controller/goodsReceipt.js`: added a top-level import of `enqueueAccountingJob` / `attemptJob` / `recordImmediateAttempt`; at both completion call sites, moved the payload construction to before `transaction.commit()`, enqueued the job inside that same transaction, and replaced the direct `postPurchaseJournal` call with the immediate-attempt-then-record pattern already proven in `purchasePayment.js`. No change to `accountingService.js`, no schema change (the `accounting_outbox` table and `purchase_journal` job type already existed).

**GREEN** — same test file, same fix in place:
```
Tests:       4 passed, 4 total
```

## G. Reliability Guarantees — 5 transactional-consistency scenarios, proven

1. **Commit-then-fail** (business txn commits, accounting posting fails): proven by `goods-receipt-accounting-outbox.test.js`'s third test — a `purchase_journal` job crafted with `store: null` (forces the real `account.store NOT NULL` constraint, the same failure class as a transient DB blip) fails `attemptJob` and the row stays `pending`, not lost. Pre-fix, the equivalent GR failure was swallowed by `console.error` with no trace.
2. **Rollback-with-orphan-event**: `enqueueAccountingJob(..., transaction)` runs inside the *same* transaction as the business rows; the catch block does `await transaction.rollback()` before rethrowing. Since the outbox INSERT is part of that transaction, a rollback removes it along with the receipt/stock rows — proven by code structure (identical to the already-shipped `purchasePayment.js` shape), no orphan is possible.
3. **Worker-crash-before-mark-processed**: `drainAccountingOutbox`'s claim (`FOR UPDATE SKIP LOCKED`) and `markPosted`/`markAttemptFailed` run in one `claimTx`, but the actual journal write inside `attemptJob` → `postPurchaseJournal` → `createJournalEntry` runs in its **own**, separate transaction (no `transaction` is threaded through the drained payload). If a crash happens between that inner commit and `claimTx`'s commit, the row reverts to `pending` and is reprocessed — but `createJournalEntry`'s dedupe (`existingEntry` check + unique index) means the replay finds the already-posted entry and returns it instead of duplicating. This exact mechanism is already proven jobType-agnostic by `accounting-journal-concurrency.test.js` ("outbox duplicate processing produces exactly one journal entry", "two concurrent drain passes over the same pending rows") — since GR now shares the identical `createJournalEntry` pipeline, that coverage applies transitively.
4. **Multi-retry**: `financial-integrity-fixes.test.js`'s exhaustion test proves a job is retried up to `MAX_ATTEMPTS=5` and only then marked `failed` (with the real error preserved) — this logic is jobType-agnostic (`markAttemptFailed` never branches on `jobType`). Combined with this batch's own first-attempt-failure test for `purchase_journal` specifically, multi-retry is proven for GR's job type.
5. **Concurrent-worker-race**: `accounting-journal-concurrency.test.js`'s "two concurrent drain passes over the same pending rows" test proves the `FOR UPDATE SKIP LOCKED` claim prevents double-claiming — jobType-agnostic, applies identically once GR's jobs exist in the table.

## H. Idempotency Mechanism

**At-least-once delivery + idempotent processing** (not at-most-once) — the same classification already established for Order/Sales-Return/Purchase-Payment, now also true for Goods Receipt:
- Delivery is at-least-once: a row can be attempted immediately, then again by the scheduler, then again after a crash mid-drain.
- Processing is made idempotent by `createJournalEntry`'s replay-on-duplicate logic, backed by the real DB partial unique index `(store, sourceType, referenceId) WHERE deletedAt IS NULL` as the final backstop (not `ON CONFLICT`, but an equivalent effect: the insert either succeeds once or the constraint violation is caught and the existing row is returned).
- No lease/lock is needed beyond `FOR UPDATE SKIP LOCKED` at claim time, since duplicate processing is harmless by construction.

## I. Store Isolation

Verified by `goods-receipt-accounting-outbox.test.js`: every assertion scopes by `location.id` (a dedicated `GR_OUTBOX_STORE` fixture), and the first test explicitly asserts `outboxRows[0].store === location.id`. `enqueueAccountingJob` always receives `store: effectiveStore` / `store: receipt.store` (both GR call sites), matching the store the business event belongs to — no cross-store leakage path exists since `postPurchaseJournal`'s accounts are provisioned per-store via `findOrCreateAccount(store, code)`.

## J. Money Safety

No change to any monetary computation, rounding, tax formula, HPP logic, or currency handling. `postPurchaseJournal`'s body (`accountingService.js:512-564`) is byte-for-byte unchanged by this batch — `git diff` touches only `api/controller/goodsReceipt.js`. The outbox payload narrows `items` to exactly the two fields `postPurchaseJournal` already consumed (`costPrice`, `qtyReceived`), passed through unmodified from the same `receiptItems` array the pre-fix code built inside the transaction — no new rounding or conversion introduced. Integer/BIGINT money fields, `purchase_order.taxAmount`, and F22-B2-01's tax-exclusion behavior are all unchanged (see Finding F22-B2-01, carried forward, not re-opened).

## K. Regression

Commands run (from `BE-POS-App`, CI-equivalent where noted):

```
npx jest __tests__/goods-receipt-accounting-outbox.test.js --runInBand
  → Tests: 4 passed, 4 total   (RED before fix: 3 failed, 1 passed)

npx jest __tests__/goods-receipt-cost-formula.test.js __tests__/goods-receipt-ingredient-identity.test.js \
  __tests__/goods-receipt-reversal-flow.test.js __tests__/goods-receipt-cost-concurrency.test.js --runInBand
  → Tests: 19 passed, 19 total  (protected file included, untouched)

npx jest __tests__/accounting-journal-flow.test.js __tests__/accounting-journal-concurrency.test.js \
  __tests__/accounting-provisioning-concurrency.test.js __tests__/financial-integrity-fixes.test.js \
  __tests__/purchase-payment-flow.test.js __tests__/order-resurrection-rejection.test.js \
  __tests__/split-bill-hardening.test.js --testPathIgnorePatterns='.claude/worktrees' --runInBand
  → Tests: 40 passed, 40 total (run twice; first run had 1 unrelated cross-file-pollution
    flake in accounting-journal-flow.test.js's trial-balance test — passed in isolation and
    on re-run of the full batch; not caused by this change, no GR/accounting code touches
    that route)

npx jest __tests__/ap-reminder-service.test.js __tests__/business-date-timezone.test.js \
  __tests__/purchase-order-flow.test.js __tests__/purchase-order-tax.test.js \
  __tests__/purchase-return-reject-flow.test.js __tests__/purchase-return-reject-uom-reversal.test.js \
  __tests__/purchase-return-uom-conversion.test.js --testPathIgnorePatterns='.claude/worktrees' --runInBand
  → Tests: 64 passed, 64 total  (Phase 21 + Phase 22 protections all intact)

npx eslint api/ utils/ --max-warnings 0
  → exit 0 (matches CI's `.github/workflows/ci.yml` lint step exactly)
```

Note: `.claude/worktrees/*` contains four unrelated stale worktrees from earlier, unrelated sessions (`phase10-checkout-remediation`, `phase12-batch2-kds-all-stores`, `phase14-batch1-be`, `phase19-batch3b-be`); jest's default filename matching picks up their same-named test files unless excluded. This is a pre-existing repo/environment characteristic, not something this batch altered — `--testPathIgnorePatterns` was used to scope regression runs to the actual working tree instead of changing any application or CI configuration.

Full BE suite and FE tests/build were not run: FE was not touched (see Section L), and the full BE suite's known environment OOM behavior was not re-triggered since targeted runs above already cover every touched and adjacent module.

## L. FE Impact

**None. FE changes were unnecessary.** `POST /goods-receipt/create` and `PATCH /goods-receipt/status/:id`'s response shape is byte-for-byte unchanged — the fix only changes *when and how durably* the server-side accounting side effect happens, not any request/response contract. Confirmed no FE file references `accounting_outbox` or `purchase_journal` (`grep -rl "accounting_outbox\|purchase_journal" src/` → empty). FE `master` HEAD `637da9a4` remains untouched.

## M. Deferred Items (explicitly not converted into scope)

- **F22-B4-01** — Vercel scheduler execution gap (`setInterval`-based schedulers, including `accountingOutboxScheduler.js` itself, never run on Vercel deployment). Explicitly out of scope per this batch's instructions; not investigated further, not touched.
- **F22-B5-02** — Purchase Return fire-and-forget journal posting. Confirmed still accurate; not fixed (single-fix limit). Strong Batch 6 candidate — same mechanical shape as this batch's GR fix.
- **F22-B5-03** — Expense fire-and-forget journal posting. Confirmed still accurate; not fixed. Needs its own design pass (create/update/delete-reactive dispatcher doesn't map onto the outbox's single-post contract without a decision on how to express "delete this job").
- **F22-B2-01** (carried forward) — GR/Purchase journal AP figures don't reflect `purchase_order.taxAmount`. Accounting-policy decision, explicitly not invented in this batch.
- CBD, CAD, tenor auto due-date policy — not touched, not investigated this batch (no relation to accounting outbox reliability).
- Purchase Return tax behavior — separate from F22-B5-02; not redesigned.

Nothing above was silently folded into this batch's scope.
