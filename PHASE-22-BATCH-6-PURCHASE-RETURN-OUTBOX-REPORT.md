# PHASE 22 — BATCH 6 — PURCHASE RETURN ACCOUNTING OUTBOX PARITY

## A. Verdict

**PASS — ONE PRODUCTION FIX IMPLEMENTED**

Purchase Return journal posting (F22-B5-02) was confirmed fire-and-forget from current code, not assumed from the Batch 5 report. It is structurally identical to Batch 5's Goods Receipt finding — a single "post once" call, one call site, `purchase_return_journal` already a registered outbox job type. It has been wired through the existing durable accounting outbox using the exact same pattern already proven for Order, Sales Return, Purchase Payment, and Goods Receipt. No accounting-policy decision was required or made.

## B. Baseline

- BE HEAD before work: `cc160c3` (Batch 5 merge commit)
- FE HEAD: `637da9a4`
- Branch: `master`
- Working tree before work: clean aside from the protected file (`git status --short` showed only `?? __tests__/goods-receipt-cost-concurrency.test.js`)

## C. Current Architecture (as re-proven this batch)

Traced the full Purchase Return lifecycle from current code, not the Batch 5 report:

- **Create** (`purchaseReturnController.create`, `purchaseReturn.js:731-1046`) — validates the PO and return quantities against `receivedQuantity` minus already-returned quantity, writes the return + items inside its own transaction (`t`, committed at line 1030). **No journal is posted here** — the return is created in `pending` status only.
- **Approve** (`purchaseReturnController.approve`, `purchaseReturn.js:304-492`) — the only call site that ever posts a Purchase Return journal. Inside its own transaction (`t`): updates the return to `approved`, reduces the linked PO's `finalAmount` by `returnTotal` (computed as `Σ(poItem.price × item.qty)`), and — only for `resolution: 'replacement'` — creates a replacement PO. Before this batch, immediately after `await t.commit()`, if `returnTotal > 0` it called `postPurchaseReturnJournal(...)` directly inside a bare `try { } catch (e) { console.error(...) }`.
- **Reject** (`purchaseReturnController.reject`, `purchaseReturn.js:494-639`) — reverses stock via the shared locked helper, has its own transaction (committed at line 613). Confirmed via `grep`: **never** calls `postPurchaseReturnJournal` — a rejected return has no financial effect, so this is correct existing behavior, not part of this batch's scope.
- **`postPurchaseReturnJournal`** (`accountingService.js:607-644`, re-read in full, byte-for-byte unchanged from Batch 5's read): a pure "post once" function — `Dr AP / Cr Inventory` for `amt = toNumber(amount)`, `sourceType: 'purchase_return'`, `referenceId: purchaseReturnId` — delegates entirely to `createJournalEntry` for transaction handling, idempotent dedupe, and the DB unique-index backstop. No internal complexity (no create/update/delete-reactive dispatch, unlike Expense).
- **`grep -rn "postPurchaseReturnJournal" api/`** confirms exactly one call site repo-wide (the `approve()` endpoint) plus its definition and its already-existing `JOB_HANDLERS` registration (`purchase_return_journal: accountingService.postPurchaseReturnJournal`, `accountingOutboxService.js:40`, unchanged since Batch 5 — confirmed via `git diff cc160c3 -- api/service/accountingOutboxService.js` returning empty).

**There is exactly one completion call site** (`approve()`) — the prompt's caution "there may be more than one path" was checked and does not apply here (unlike Goods Receipt, which had two).

## D. Root Cause

Same defect class as F22-B5-01 (Goods Receipt, fixed in Batch 5): a genuine failure during `postPurchaseReturnJournal` (a transient DB blip, connection pool exhaustion — the same class of failure `createJournalEntry`'s own comment says now **throws** rather than returning null, per the Phase 21 remediation commit `8061d4f8`) was caught by the bare `try/catch` and only logged via `console.error`. The business event (stock restored, PO `finalAmount` reduced) stayed committed while the AP/inventory reversal journal silently never existed — no retry, no durable trace, discoverable only by manual reconciliation. This is a genuine reliability defect, not an accounting-policy question: the fix changes *when and how durably* the journal is posted, not what it says or how it's computed.

## E. Fix

**File:** `api/controller/purchaseReturn.js` (only file changed)

**Import added** (top of file, mirrors `purchasePayment.js` / `goodsReceipt.js`):
```js
const {
  enqueueAccountingJob,
  attemptJob,
  recordImmediateAttempt
} = require('../service/accountingOutboxService')
```

**Call site** (`approve()`, `purchase-return.js:349-486` region): the enqueue was moved to **before** `t.commit()`, using the same `t` transaction as the return/PO/stock rows already being written:
```js
if (returnTotal > 0) {
  journalJob = await enqueueAccountingJob({
    jobType: 'purchase_return_journal',
    store: ret.store,
    referenceType: 'purchase_return',
    referenceId: id,
    payload: {
      store: ret.store,
      purchaseReturnId: id,
      returnNumber: ret.returnNumber,
      amount: returnTotal,
      date: new Date().toISOString(),
      createdBy: req.user?.id
    },
    transaction: t
  })
}

await t.commit()

if (journalJob) {
  const journalResult = await attemptJob(journalJob)
  await recordImmediateAttempt(journalJob, journalResult)
  if (!journalResult.ok) {
    console.error('Purchase return journal deferred to retry queue:', journalResult.error)
  }
}
```

- **Job type:** `purchase_return_journal` — already registered in `JOB_HANDLERS`, no new job type introduced.
- **Transaction behavior:** the outbox row is inserted inside `t`, the same transaction as `ret.update`, the PO `finalAmount` reduction, and (for `replacement`) the replacement PO rows. A rollback (the `catch (err) { await t.rollback(); throw err }` wrapping the whole block) removes the outbox row along with everything else — proven directly in Section F/G, not just asserted.
- **Post-commit behavior:** identical to Batch 5 — one immediate best-effort attempt via `attemptJob` + `recordImmediateAttempt`; failure does not roll back the already-committed approval, and leaves the row `pending` for the scheduler.
- **Idempotency mechanism:** unchanged, inherited from `createJournalEntry` — dedupe by `(store, sourceType, referenceId)` = `(store, 'purchase_return', purchaseReturnId)`, backed by the real DB partial unique index. No second idempotency key was invented.

## F. TDD Evidence

**RED** — `__tests__/purchase-return-accounting-outbox.test.js` written first, run against unmodified `purchaseReturn.js` (still calling `postPurchaseReturnJournal` directly):
```
Tests:       3 failed, 3 passed, 6 total
```
The 3 failures were exactly the tests that depend on the controller enqueuing a row (durability, re-drain/idempotency-through-outbox, store isolation via the outbox) — `accounting_outbox` had zero rows for `referenceType: 'purchase_return'` after a real approval, because no code path ever enqueued one. The 3 passes were the tests exercising the outbox primitives directly (`enqueueAccountingJob`/`attemptJob` — the transactional-rollback proof and the immediate-attempt-failure proof), which don't depend on the controller wiring and correctly passed even pre-fix, confirming the *registered handler* was never the problem — only the *never-enqueued* call site was. (One duplicate-processing test that also calls the real approval endpoint failed pre-fix for the same reason as the durability test and is counted among the 3 failures.)

**Smallest fix** — as described in Section E: relocate the enqueue to before commit, replace the direct call with immediate-attempt-then-record. No change to `accountingService.js`, no schema change.

**GREEN** — same test file, fix in place:
```
Tests:       6 passed, 6 total
```

**Regression:**
```
npx jest __tests__/purchase-return-accounting-outbox.test.js __tests__/purchase-return-reject-flow.test.js \
  __tests__/purchase-return-reject-uom-reversal.test.js __tests__/purchase-return-uom-conversion.test.js \
  __tests__/goods-receipt-accounting-outbox.test.js __tests__/goods-receipt-cost-formula.test.js \
  __tests__/goods-receipt-ingredient-identity.test.js __tests__/goods-receipt-reversal-flow.test.js \
  __tests__/goods-receipt-cost-concurrency.test.js __tests__/accounting-journal-flow.test.js \
  __tests__/accounting-journal-concurrency.test.js __tests__/accounting-provisioning-concurrency.test.js \
  __tests__/financial-integrity-fixes.test.js __tests__/purchase-payment-flow.test.js \
  __tests__/order-resurrection-rejection.test.js __tests__/split-bill-hardening.test.js \
  __tests__/ap-reminder-service.test.js __tests__/business-date-timezone.test.js \
  __tests__/purchase-order-flow.test.js __tests__/purchase-order-tax.test.js \
  --testPathIgnorePatterns='.claude/worktrees' --runInBand

  → Test Suites: 20 passed, 20 total
  → Tests:       129 passed, 129 total
```
(Goods Receipt's outbox regression, all Phase 21 UOM/reject protections, and Batch 4/5 Phase 22 protections included and passing.)

```
npx eslint api/ utils/ --max-warnings 0
  → exit 0 (matches CI's .github/workflows/ci.yml lint step exactly)
```

## G. Failure Matrix

| Scenario | Expected | Actual |
|---|---|---|
| Approval success | `accounting_outbox` row created (jobType `purchase_return_journal`, referenceType `purchase_return`), immediately posted, `journal_entry` (`sourceType: 'purchase_return'`) exists with correct `totalDebit`/`totalCredit` | **Confirmed** — test "approving a purchase return enqueues a durable purchase_return_journal job and posts it immediately" |
| Transaction rollback | A rollback between enqueue and commit leaves no outbox row | **Confirmed directly** — test "enqueueAccountingJob rolls back with its transaction" reproduces `approve()`'s exact try/`t.rollback()` shape against the real primitive: the enqueued row is gone after the forced rollback |
| Immediate attempt failure | Approval stays committed; outbox row stays `pending`, not lost | **Confirmed** — test "a purchase_return_journal job whose immediate posting fails stays pending..." (real `account.store NOT NULL` failure, same failure class as a transient DB blip) |
| Worker retry | A `pending` row is picked up and posted by `drainAccountingOutbox` on a later tick | **Confirmed by shared, jobType-agnostic mechanism** — `MAX_ATTEMPTS`/`markAttemptFailed` logic never branches on `jobType` (already proven generically by `financial-integrity-fixes.test.js`'s exhaustion test); this batch's own failure test proves the first-attempt-fails/stays-pending half specifically for `purchase_return_journal` |
| Duplicate processing | Two jobs (or a re-drain) for the same reference never create two journal entries | **Confirmed** — "a second, independently-crafted job... replays the existing journal instead of duplicating it" and "re-draining after a purchase return job already posted does not create a duplicate journal entry" |
| Concurrent processing | Two concurrent drains never double-claim/double-post the same row | **Confirmed by shared, jobType-agnostic mechanism** — `drainAccountingOutbox`'s `FOR UPDATE SKIP LOCKED` claim never branches on `jobType`; already proven generically by `accounting-journal-concurrency.test.js`'s "two concurrent drain passes over the same pending rows" test, which now transitively covers `purchase_return_journal` since it shares the identical `createJournalEntry` pipeline |
| Cross-store processing | Store A's approval never creates or reuses a Store B outbox/journal row | **Confirmed** — "store isolation: a store A purchase return only creates outbox/journal rows scoped to store A" (two full store fixtures, cross-store leak query asserted empty) |

## H. Accounting Policy

**No accounting policy was changed.** `postPurchaseReturnJournal`'s body in `accountingService.js` is byte-for-byte unchanged by this batch (`git diff` touches only `api/controller/purchaseReturn.js`). The `Dr AP / Cr Inventory` amount (`returnTotal`, computed as `Σ(poItem.price × item.qty)`) is passed through unmodified — no rounding, tax, or currency-handling change. Known limitations are explicitly preserved, not fixed: the journal amount is computed from PO item price only and does not reflect `purchase_order.taxAmount` (mirrors GR's F22-B2-01 exactly, on the same deferred basis) — Purchase Tax accounting treatment remains undecided and untouched.

## I. Deferred

- **F22-B4-01** — Vercel scheduler runtime gap. Not touched.
- **F22-B5-03** — Expense fire-and-forget journal posting. Not touched; still needs its own design pass (create/update/delete-reactive dispatcher).
- **F22-B2-01** — Purchase Tax accounting treatment (GR and, by the same reasoning, Purchase Return journals don't reflect `taxAmount`). Not decided, not touched.
- Purchase Return tax behavior — not redesigned.
- CBD, CAD, tenor auto due-date policy — not touched.
- External notification providers — not touched.

Nothing above was silently folded into this batch's scope.
