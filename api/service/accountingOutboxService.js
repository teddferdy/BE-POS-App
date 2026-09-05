'use strict'
const db = require('../../db/models')
const { Op } = require('sequelize')
const accountingService = require('./accountingService')

// Durable retry queue for accounting journal posting.
//
// Every place that posts a journal entry as a side effect of a business
// event (order creation, sales return approval, purchase payment, expense
// approval, goods receipt, ...) used to call the posting function directly
// after its own transaction committed, wrapped in try/catch(console.error) —
// a transient failure there (a DB blip, pool exhaustion) meant the business
// event stayed committed (order paid, stock deducted, cash ledger row
// written) while the accounting entry silently never existed, discoverable
// only by manual reconciliation.
//
// The fix: the caller now also inserts a row here INSIDE its own
// transaction (enqueueAccountingJob) before that transaction commits — a
// plain INSERT can't fail independently the way an accounting call can, so
// this row's existence is exactly as durable as the business event it's
// attached to. The caller still attempts the actual posting immediately
// after commit for the common case (entries usually appear right away);
// on success it calls markPosted so the row never lingers for the
// scheduler to redundantly reprocess. On failure it's left `pending` and
// accountingOutboxScheduler.js retries it later with bounded attempts,
// escalating to Sentry once exhausted instead of discarding the failure.

const MAX_ATTEMPTS = 5

// Maps a jobType to the accountingService function it dispatches to.
// `payload` keys must exactly match that function's destructured params
// (everything except `transaction` — a drained job posts in its own fresh
// transaction, same as the original post-commit call never had one either).
const JOB_HANDLERS = {
  order_journal: accountingService.postOrderJournal,
  order_cogs_journal: accountingService.postOrderCogsJournal,
  reverse_order_journals: accountingService.reverseOrderJournals,
  sales_return_journal: accountingService.postSalesReturnJournal,
  purchase_journal: accountingService.postPurchaseJournal,
  purchase_payment_journal: accountingService.postPurchasePaymentJournal,
  purchase_return_journal: accountingService.postPurchaseReturnJournal,
  expense_journal: accountingService.postExpenseJournal,
  overtime_payroll_journal: accountingService.postOvertimePayrollJournal
}

function assertKnownJobType(jobType) {
  if (!JOB_HANDLERS[jobType]) {
    throw new Error(`Unknown accounting outbox jobType: ${jobType}`)
  }
}

async function enqueueAccountingJob({
  jobType,
  store,
  referenceType,
  referenceId,
  payload,
  transaction
}) {
  assertKnownJobType(jobType)
  return db.accounting_outbox.create(
    {
      jobType,
      store: store || null,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      payload: payload || {}
    },
    { transaction }
  )
}

// Runs the actual posting function for one row. Never throws — the caller
// (either the immediate post-commit attempt or the scheduler) decides what
// to do with a failure; this just reports it.
async function attemptJob(row) {
  const handler = JOB_HANDLERS[row.jobType]
  if (!handler) {
    return { ok: false, error: `Unknown jobType: ${row.jobType}` }
  }
  try {
    // JSONB round-trips Date as an ISO string; the posting functions all
    // pass `date` straight to `new Date(...)`/moment-style formatting, so
    // rehydrate it before dispatching.
    const payload = { ...row.payload }
    if (payload.date) payload.date = new Date(payload.date)
    await handler(payload)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}

async function markPosted(outboxRow) {
  await outboxRow.update({
    status: 'posted',
    postedAt: new Date(),
    lastError: null
  })
}

async function markAttemptFailed(outboxRow, error) {
  const attempts = outboxRow.attempts + 1
  const exhausted = attempts >= MAX_ATTEMPTS
  await outboxRow.update({
    attempts,
    lastError: String(error).slice(0, 2000),
    status: exhausted ? 'failed' : 'pending'
  })
  if (exhausted) {
    try {
      const Sentry = require('../instrument')
      Sentry.captureMessage(
        `Accounting outbox job permanently failed after ${attempts} attempts: ${outboxRow.jobType} (${outboxRow.referenceType || 'unknown'}#${outboxRow.referenceId || '?'})`,
        'error'
      )
    } catch {
      // Sentry is a no-op without SENTRY_DSN — never let alerting itself
      // be the thing that throws inside a background drain loop.
    }
    console.error(
      `ACCOUNTING OUTBOX PERMANENTLY FAILED: job ${outboxRow.id} (${outboxRow.jobType}, ${outboxRow.referenceType || 'unknown'}#${outboxRow.referenceId || '?'}) — ${error}`
    )
  }
}

// Called right after a caller's own immediate post-commit attempt, whether
// it succeeded or failed — keeps the outbox row's state in sync with what
// actually happened instead of leaving it `pending` when posting already
// succeeded synchronously.
async function recordImmediateAttempt(outboxRow, result) {
  if (result.ok) {
    await markPosted(outboxRow)
  } else {
    await markAttemptFailed(outboxRow, result.error)
  }
}

// Drains up to `limit` retryable rows, oldest first. Meant to be called
// from a scheduler tick (accountingOutboxScheduler.js) or a manual ops
// script — nothing here assumes which.
async function drainAccountingOutbox({ limit = 50 } = {}) {
  const rows = await db.accounting_outbox.findAll({
    where: { status: 'pending', attempts: { [Op.lt]: MAX_ATTEMPTS } },
    order: [['createdAt', 'ASC']],
    limit
  })

  let posted = 0
  let failed = 0
  for (const row of rows) {
    const result = await attemptJob(row)
    await recordImmediateAttempt(row, result)
    if (result.ok) posted += 1
    else failed += 1
  }
  return { processed: rows.length, posted, failed }
}

module.exports = {
  MAX_ATTEMPTS,
  JOB_HANDLERS,
  enqueueAccountingJob,
  attemptJob,
  markPosted,
  markAttemptFailed,
  recordImmediateAttempt,
  drainAccountingOutbox
}
