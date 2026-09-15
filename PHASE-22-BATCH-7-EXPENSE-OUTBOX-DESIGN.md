# PHASE 22 — BATCH 7 — EXPENSE ACCOUNTING OUTBOX — DESIGN PASS

## 1. Verdict

**READY FOR TDD IMPLEMENTATION** (with one scoping note for Batch 8, not a blocker — see §10)

A safe design exists (Option C, state-reconciliation) that requires **zero** accounting-policy decisions, reuses the existing `syncExpenseJournal` / `updateExpenseJournal` / `deleteExpenseJournal` functions **completely unchanged**, needs **zero schema changes**, and is structurally immune to the stale-event and delete-race corruption scenarios that make Options A and B unsafe as literally specified. The one thing Batch 8 must budget for beyond "wire the outbox" is that most Expense call sites currently have **no business transaction at all** around the expense mutation — see §10.

## 2. Current Expense Lifecycle (proven from code, not assumed)

`db/models/expense.js`: `paranoid: true` (soft delete via `deletedAt`), `status` enum `pending/approved/rejected/draft`, plus independent `isActive` (archive flag) and `isPaid`/`paidAt` (payment settlement — has its own `expense_payment` child table with **no journal of its own**; payment/settlement is out of scope for this design, same as it was for the original `syncExpenseJournal`).

Eight real call sites into the journal layer, traced in full:

| # | Controller fn | Business-row mutation | Wrapped in `db.sequelize.transaction`? | Journal call | Timing relative to any transaction |
|---|---|---|---|---|---|
| 1 | `create()` (only if `status==='approved'` at creation, an unusual path) | `db.expense.create(...)` | **No** | `syncExpenseJournal` (fire-and-forget try/catch) | N/A — no transaction exists |
| 2 | `bulkCreate()` (per record, only if `status==='approved'`) | `db.expense.create(..., {transaction})`, looped | **Yes** | `syncExpenseJournal`, looped | **After** `transaction.commit()` — outside it |
| 3 | `update()` | `expense.update(...)` (unconditional) | **No** | `syncExpenseJournal` (fire-and-forget) | N/A |
| 4 | `approve()` | `expense.update({status:'approved'})` | **No** | `syncExpenseJournal` (fire-and-forget) | N/A |
| 5 | `reject()` | `expense.update({status:'rejected'})` | **No** | `deleteExpenseJournal` directly (fire-and-forget) | N/A |
| 6 | `setActive()` | `expense.update({isActive})` | **No** | `syncExpenseJournal` (fire-and-forget) | N/A |
| 7 | `delete()` | `expense.destroy()` (paranoid soft delete) | **No** | `deleteExpenseJournal` directly (fire-and-forget) | N/A |
| 8 | `generateSalary()` (per employee) | `db.expense.create(..., {transaction})`, looped | **Yes** | `syncExpenseJournal(payload, {transaction})` — **two positional arguments** | Attempted inside the transaction, but see finding below |
| — | `markPaid()` / `markUnpaid()` | `db.expense_payment.create(...)`, `expense.update({isPaid, ...})` | No | **None** — these two paths never touch the journal at all | N/A |

**Confirmed pre-existing bug (documented, not fixed — out of scope for a design-only batch):** `generateSalary()` calls `syncExpenseJournal({...fields...}, {transaction})` — but `syncExpenseJournal`'s signature (`accountingService.js:1025`) is a **single** destructured-object parameter that includes `transaction` as one of its own keys, not a second positional argument. The `{transaction}` second argument is silently ignored by JavaScript's destructuring, so `transaction` inside the callee is `undefined`, and `updateExpenseJournal`/`postExpenseJournal` fall through to `db.sequelize.transaction(rewrite)` — opening their **own**, separate transaction. This is the one place in the codebase where someone clearly *intended* the journal write to participate in the caller's transaction, and the attempt is currently broken. This is strong independent evidence that "make the journal write transactional with its business event" was already the intended direction — it just was never wired correctly, and never durably (no outbox involved here either).

**Canonical dispatcher** — `syncExpenseJournal` (`accountingService.js:1025-1055`, read in full, unchanged since Batch 5):
```js
if (status === 'approved' && isActive !== false) {
  return updateExpenseJournal({...})   // create-if-missing, else rewrite lines in place
}
return deleteExpenseJournal({...})     // soft-delete the journal_entry if one exists
```
This function is the **single source of truth** for "what should the journal look like given the expense's current status/isActive" — it already implements exactly the create/update/delete decision Batch 7 needs to deliver durably. The design problem is entirely about *how reliably and safely this function gets invoked*, never about *what it computes*.

## 3. Current Failure Modes (concrete)

| Expense Operation | Business Transaction | Accounting Action | Current Durability | Failure Impact |
|---|---|---|---|---|
| **CREATE** (`create()`, `bulkCreate()`, `generateSalary()`) | None / own-tx-but-outside / own-tx-but-broken-passthrough | CREATE (via `updateExpenseJournal`'s not-found branch → `postExpenseJournal`) | Not durable — fire-and-forget | A posting failure at creation permanently loses the initial journal. The expense exists in business data; the ledger never reflects it. Only `console.error` — no retry, no alert. |
| **UPDATE** (`update()`, `approve()`, `setActive(isActive:true)`) | None | REWRITE (destroy+recreate lines in place via `updateExpenseJournal`) | Not durable | A posting failure leaves the journal reflecting the **previous** amount/category/payment method while the expense record already shows the **new** values — a silent, invisible divergence between business data and the ledger, potentially indefinitely. |
| **DELETE/CANCEL** (`reject()`, `delete()`, `setActive(isActive:false)`) | None | DELETE (soft, via `deleteExpenseJournal`) | Not durable | A posting failure leaves a **stale, still-active** journal entry for an expense that is now rejected/deleted/archived — the ledger **overstates** expenses no longer valid. Arguably the worst of the three failure modes: an overstatement, not merely an omission. |

All three share the exact reliability defect already fixed for Goods Receipt (F22-B5-01) and Purchase Return (F22-B5-02): a genuine DB failure (the same class `createJournalEntry`'s own comment says now **throws** rather than returning null, per commit `8061d4f8`) is caught by a bare `try/catch(console.error)` and never retried.

## 4. Existing Outbox Contract (exact current capabilities, re-verified, nothing changed)

`api/service/accountingOutboxService.js` and its migration (`20260904000008-create-accounting-outbox.js`, read in full) support exactly **one shape**: *one job row → one registered `JOB_HANDLERS[jobType]` function call, given the row's JSONB `payload` as its sole argument.* Concretely:

- `enqueueAccountingJob({jobType, store, referenceType, referenceId, payload, transaction})` — a plain `INSERT`, transactional when a `transaction` is passed. `assertKnownJobType` only checks the `jobType` string exists in `JOB_HANDLERS` — the payload shape is entirely up to the caller/handler pair.
- `attemptJob(row)` — looks up `JOB_HANDLERS[row.jobType]`, spreads `row.payload` (rehydrating `payload.date` from its ISO string), calls the handler, never throws (returns `{ok, error}`).
- `markPosted` / `markAttemptFailed` (bounded at `MAX_ATTEMPTS=5`, Sentry escalation on exhaustion) / `recordImmediateAttempt` — all jobType-agnostic.
- `drainAccountingOutbox` — claims via `SELECT ... FOR UPDATE SKIP LOCKED`, jobType-agnostic.
- **No ordering guarantee across jobs for the same `referenceId`.** Two jobs for the same expense can be claimed and processed in either order, especially under retry (a job enqueued first can fail and retry *after* a job enqueued later has already succeeded).
- **No outbox-level uniqueness/versioning** beyond the migration's plain `(status, createdAt)` and `(referenceType, referenceId)` indexes — dedup against double-*posting* is entirely delegated to the target table (`createJournalEntry`'s `(store, sourceType, referenceId) WHERE deletedAt IS NULL` partial unique index + pre-check). The outbox itself has no concept of "supersede an older pending job for the same reference."
- The migration's own top-of-file comment explicitly lists **"expense approval"** among the flows this table was built to cover from day one — this batch closes a gap in the outbox's originally intended scope, not new territory.

**Conclusion: the outbox itself needs zero changes for any of the three options below.** The entire design question is what Expense enqueues and what the registered handler does with it.

## 5. Option Comparison

| Criteria | Option A (discriminated payload) | Option B (dedicated job types) | Option C (state-reconciliation) |
|---|---|---|---|
| Transaction safety | OK (enqueue inside business tx, same as all three) | OK (same) | OK (same) |
| Retry safety | Weak if payload is a snapshot; degrades to C if payload is thin | Same weakness as A | **Strong** — retry always reconverges to current truth |
| Idempotency | OK if state-driven, else risky | Same as A | **Strong** — reuses `syncExpenseJournal`'s existing idempotent branching untouched |
| Stale-event protection | **Weak**, unless the handler ignores the `operation` label and re-derives from current state — at which point it *is* Option C in substance | **Weak**, same root cause (the job **type** itself can go stale exactly like an operation label can) | **Strong** — inherent by construction, never trusts a captured snapshot |
| Delete safety | **Weak** — a stale `update` job replaying after a later `delete` job can resurrect a journal for a now-deleted/rejected expense, unless the handler re-checks live state (→ collapses to C) | **Weak**, identical failure shape (a stale `expense_journal_update` job after `expense_journal_delete`) | **Strong** — inherent; a deleted/rejected/inactive live expense converges to "no journal" regardless of which historical event triggered reconciliation |
| Concurrent workers | Residual gap: no row lock in `updateExpenseJournal`'s rewrite (pre-existing today, not introduced by any option) | Same residual gap | Same residual gap — not worse than A/B, and not new (see §9) |
| Schema impact | None | None | **None** |
| Code complexity | Medium (full snapshot payload) to Low (thin payload — but then behaves like C) | **Highest** — 3 job types, more registration/dispatch surface, for no safety gain over A | **Lowest** — one thin wrapper (~10 lines): load expense + category, call the existing `syncExpenseJournal` |
| Testability | Medium — must test staleness explicitly | Medium — same, plus 3x the dispatch surface | **High** — reconciliation is a pure function of "current expense row" → "desired journal," trivial to test directly |

## 6. Preferred Design: **Option C — `expense_journal_sync`**

One new job type, `expense_journal_sync`, one thin new function in `accountingService.js` (additive — no existing function is modified):

```js
// Illustrative shape only — NOT implemented this batch.
async function syncExpenseJournalFromState({ expenseId, transaction }) {
  const expense = await db.expense.findByPk(expenseId, {
    include: [{ model: db.expense_category, as: 'categoryData' }],
    transaction
  })
  if (!expense) return null   // hard-deleted or never existed — nothing to reconcile
  return syncExpenseJournal({
    store: expense.store,
    expenseId: expense.id,
    expenseNumber: expense.expenseNumber,
    category: expense.categoryData?.name || expense.description || null,
    categoryAccountCode: expense.categoryData?.accountCode || null,
    amount: expense.amount,
    date: expense.date,
    paymentMethod: expense.paymentMethod,
    status: expense.status,
    isActive: expense.isActive,
    createdBy: expense.modifiedBy || expense.createdBy,
    transaction
  })
}
```

`JOB_HANDLERS.expense_journal_sync = accountingService.syncExpenseJournalFromState` (additive registration, existing entries untouched). Payload is deliberately thin: `{ expenseId }` (plus `store`/`date` only as metadata for the outbox row's own columns/logging — the accounting write itself always re-derives every field, including `store`, from the freshly-loaded `expense` row, never from the payload, so a stale or even tampered payload cannot misroute the write cross-store).

This is preferred because it: (1) reuses the existing outbox infrastructure completely unmodified, (2) preserves current accounting semantics exactly — it is *literally the same function call* `syncExpenseJournal` already makes today, just invoked durably instead of fire-and-forget, (3) is transactionally safe to the same degree as GR/Purchase-Return once wired, (4) is retry-safe and (5) idempotent by construction, (6) is immune to stale-event regression and (7) handles delete/cancel correctly — both **by construction**, not by an added guard, (8) needs zero schema changes, (9) is the smallest code change of the three options, and (10) is the easiest to test (mutate the expense row, run the sync job, assert the journal).

## 7. Event Ordering Strategy

**No ordering is required or enforced, and none is needed.** Every `expense_journal_sync` job — regardless of which business mutation enqueued it, and regardless of the order two or more such jobs for the same expense are eventually processed in — performs the identical action: load the expense's **current** row and reconcile the journal to match it. Processing job A (enqueued first, retried last) after job B (enqueued second, processed first) does not "revert" anything, because job A does not carry B's-now-superseded data — it re-reads the same current row B already reconciled against and produces the same result. The worked example from the prompt:
```
Expense UPDATE A → event A   Expense UPDATE B → event B
Worker processes B → journal reflects current state (== B's effect)
Worker later processes A → re-reads current state (still == B's effect, unless
                            something changed again) → journal STAYS at B's
                            effect, not reverted to A's stale values
```
holds safely under Option C because "process event A" never means "apply A's captured diff" — it means "reconcile to whatever is true right now," which by the time A is (re)processed already reflects B.

## 8. Delete/Cancel Strategy

Symmetric to §7. The prompt's delete-race example:
```
Expense UPDATE → event A     Expense DELETE/CANCEL → event B
Worker processes B → reconciles: live expense is rejected/soft-deleted/inactive
                      → deleteExpenseJournal (or no-op if already deleted)
Worker later processes A → reconciles AGAIN from the SAME live (deleted/
                      rejected/inactive) expense → same outcome: no journal.
                      The journal is NOT resurrected, because reconciliation
                      never trusts A's captured "approved" snapshot — it
                      re-checks the expense's actual current status/isActive/
                      existence every time.
```
A hard-deleted expense (if that ever happens outside the paranoid soft-delete path) is handled by the `if (!expense) return null` guard — reconciliation becomes a safe no-op rather than erroring.

## 9. Idempotency Strategy

- **Duplicate CREATE**: `updateExpenseJournal`'s not-found branch → `postExpenseJournal` → `createJournalEntry`, whose `(store, sourceType, referenceId)` dedupe (pre-check + DB partial unique index) is unchanged and already proven (Batches 1/5/6). Two reconciliations racing to create the same expense's first journal cannot produce two entries.
- **Duplicate UPDATE**: `updateExpenseJournal`'s rewrite (destroy lines, recreate lines, update the header in place) is idempotent at the *result* level — replaying it against the same current state yields the same final debit/credit lines. It is **not** idempotent at the *row-identity* level (line rows get new IDs each replay) — this already happens today whenever `update()` is called twice in a row, so it is not a new characteristic introduced by the outbox.
- **Duplicate DELETE**: `deleteExpenseJournal`'s `if (!existing) return null` guard (existing is paranoid-scoped, so an already-soft-deleted entry is invisible to it) makes a repeat delete a safe no-op.
- **Retry after worker crash**: identical to "duplicate" above — a crash-and-retry just re-runs reconciliation against current truth.
- **Concurrent workers — residual gap, present today, not introduced by this design**: `updateExpenseJournal`'s rewrite does not take a row lock (`SELECT ... FOR UPDATE`) on the `journal_entry` it is rewriting. Two simultaneous reconciliations for the *same* expense (two outbox jobs claimed by two racing drain passes, or an immediate-attempt racing a scheduler tick) could theoretically interleave destroy/create calls against the same journal_entry's lines. This is a genuine, **pre-existing** gap — it exists today for any two concurrent HTTP requests that both call `update()`/`approve()` for the same expense, entirely independent of the outbox. Batch 8 should decide whether to close it as part of the outbox wiring (adding a `SELECT ... FOR UPDATE` on the `journal_entry` row inside `updateExpenseJournal`'s rewrite, mirroring the per-store lock already used for journal *creation* via `journal_entry_sequence`) or track it as a separate, explicitly-deferred finding — this is a recommendation for Batch 8 to make, not a decision this design batch is making on its own.

## 10. Transaction Boundary

Desired invariant — `Expense business mutation + accounting outbox event commit atomically` — is **technically feasible** with the existing architecture (same `enqueueAccountingJob(..., transaction)` primitive already proven for GR/Purchase-Return/Purchase-Payment/Order), but requires more than a one-line move at most Expense call sites, because **6 of 8** (`create`, `update`, `approve`, `reject`, `setActive`, `delete`) currently have **no `db.sequelize.transaction()` at all** around the expense mutation — unlike GR/Purchase-Return, where the transaction already existed and the fix was purely "move the existing enqueue inside it." Implementing this design in Batch 8 will mean, at each of those 6 call sites, wrapping the (currently bare) `expense.update(...)`/`expense.create(...)`/`expense.destroy()` call together with the new `enqueueAccountingJob(...)` call in a `db.sequelize.transaction()`, then attempting the job post-commit — the same mechanical pattern already used six times over across Batches 5/6, just applied to more call sites in one file. `bulkCreate()` and `generateSalary()` already have a transaction; they only need the enqueue moved inside it (and, for `generateSalary()`, its broken two-argument `syncExpenseJournal(...)` call is naturally *replaced* by the correctly-transactional `enqueueAccountingJob(...)` call, incidentally resolving that bug as a side effect of the outbox wiring rather than as a separate fix). This is a larger set of call-site edits than Batch 5 or 6 needed, but every edit is the identical, policy-free, mechanical transformation — consistent with "one fix" in the same sense Batch 5's two call sites and Batch 6's one call site were each "one fix." Flagged here for Batch 8's scoping, not treated as a blocker.

## 11. Test Plan (future TDD scenarios for Batch 8 — not implemented this batch)

1. **Create**: approving/creating an expense at `status: 'approved'` enqueues `expense_journal_sync` and posts a journal with `sourceType: 'expense'`.
2. **Update**: editing amount/category/payment method on an approved expense enqueues a job whose reconciliation rewrites the existing journal's lines to the new values.
3. **Delete/cancel**: rejecting, soft-deleting, or archiving (`isActive:false`) an approved expense enqueues a job whose reconciliation soft-deletes the journal.
4. **Rollback**: forcing an error between enqueue and commit (same direct-primitive proof pattern used in Batch 6) leaves no durable outbox row.
5. **Retry**: an immediate-attempt failure (e.g. a forced `account.store NOT NULL` failure, same trick as Batches 5/6) leaves the row `pending`, recoverable by `drainAccountingOutbox`.
6. **Duplicate**: replaying the same `expense_journal_sync` job (or re-draining after it already posted) produces exactly one journal entry, not two.
7. **Concurrent worker**: two simultaneous reconciliations for the same `expenseId` — assert no duplicate/corrupted lines (this test should also serve as the regression proof for whichever concurrency decision Batch 8 makes per §9).
8. **Stale update**: enqueue update-job-A, then update-job-B (B reflecting a *later* amount change), process B then A — assert the journal reflects B's amount, not A's, after both are processed (the core §7 proof).
9. **Update → delete race**: enqueue an update job, then a delete job, process delete first then the stale update — assert the journal remains absent/deleted, not resurrected (the core §8 proof).
10. **Delete → retry**: a delete reconciliation whose immediate attempt fails must still converge correctly once retried — assert the journal is gone after the retry succeeds, not left stale-active.
11. **Cross-store isolation**: a Store A expense's `expense_journal_sync` job only ever touches Store A's journal — reuse the two-store fixture pattern already established in Batch 6's store-isolation test.

## 12. Scope

Production files changed:
```text
NONE
```
FE changes:
```text
NONE
```
Schema changes:
```text
NONE
```
Accounting policy changes:
```text
NONE
```
