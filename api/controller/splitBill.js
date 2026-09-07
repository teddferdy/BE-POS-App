const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const {
  deductStockForPaidOrder,
  enqueueOrderAccountingJobs,
  attemptOrderAccountingEntries
} = require('./order')
const { scalarStoreScope } = require('../../utils/tenantScope')
const { withDeadlockRetry } = require('../../utils/deadlockRetry')

// split_bill has no store column of its own — ownership is entirely
// inherited through order.store (a plain INTEGER, same shape scalarStoreScope
// already handles), so every entry point below that receives a raw order id
// or a split id first proves the parent order belongs to the caller's store
// before any lock/mutation happens.
//
// F5: every mutating operation (create/cancel/pay/merge) now locks the
// parent `order` row FIRST, unconditionally, before touching any
// split_bill row — uniform lock ordering, closing the previous
// split-before-order ordering in cancel() and the conditional (paid-only)
// order lock in pay(). This single lock is what serializes the amount
// invariant below against any concurrent create/cancel/pay/merge on the
// same order; no split_bill-level lock is ever acquired first.
//
// "Active" split amount is SUM(amount) with no status filter — cancelled
// splits are soft-deleted (paranoid: true) and the model has no
// 'cancelled' status value at all, so Sequelize's default scope already
// excludes them from every ORM query below. Raw SQL would need an
// explicit `AND "deletedAt" IS NULL`; none is used here.

const generateSplitNumber = () => {
  const date = new Date()
  const timestamp = date.getTime().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SPL${timestamp}${random}`
}

// Postgres JSONB / plain object comparisons are key-order sensitive —
// canonicalizing before comparing avoids false "different payload"
// mismatches. Same pattern established in F3/F4.
function canonicalJSON(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

// A single idempotencyKey covers an entire batch of splits (not one row
// per key, unlike F4's shape) — compare the ordered list of amounts.
function splitBillPayloadMatches(existingSplits, incomingItems) {
  const existing = existingSplits
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((s) => ({ amount: Number(s.amount) }))
  const incoming = incomingItems.map((i) => ({ amount: Number(i.amount) }))
  return canonicalJSON(existing) === canonicalJSON(incoming)
}

const splitBillController = {
  async create(req, res) {
    try {
      const { order, items, idempotencyKey } = req.body
      const createdBy = req.user?.id || null

      if (!order || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order and items are required'
        })
      }

      let splits
      try {
        splits = await withDeadlockRetry(() =>
          db.sequelize.transaction(async (t) => {
            // Order-first lock — the sole serialization point for both
            // the amount invariant below and create-retry idempotency.
            // IDOR fix (preserved): was findByPk(order) with no store
            // filter.
            const orderRow = await db.order.findOne({
              where: scalarStoreScope(req, { id: order }),
              lock: t.LOCK.UPDATE,
              transaction: t
            })
            if (!orderRow) {
              const e = new Error('Order not found')
              e.statusCode = 404
              throw e
            }

            // Idempotency check — inside the transaction, under the
            // order lock just acquired. A concurrent identical retry
            // blocks on that lock until this transaction commits, then
            // finds the rows this call is about to create — no DB
            // unique constraint is needed (see migration comment: one
            // key legitimately covers multiple rows here, which a
            // unique index on (order, idempotencyKey) cannot express).
            if (idempotencyKey) {
              const existing = await db.split_bill.findAll({
                where: { order, idempotencyKey },
                order: [['id', 'ASC']],
                transaction: t
              })
              if (existing.length > 0) {
                if (splitBillPayloadMatches(existing, items)) {
                  const replay = new Error('IDEMPOTENT_REPLAY')
                  replay.isIdempotentReplay = true
                  replay.existing = existing
                  throw replay
                }
                const e = new Error('idempotencyKey already used with a different payload')
                e.statusCode = 409
                throw e
              }
            }

            // F5-2: order-state eligibility, derived from the actual
            // state machine (traced fresh, not copied from F4) —
            // paymentStatus only ever leaves 'unpaid' via this
            // controller's own completion branch below or F4's refund
            // recompute; 'partial' is exclusively a refund artifact and
            // never a natural split-bill precondition.
            if (
              orderRow.paymentStatus !== 'unpaid' ||
              ['cancelled', 'void'].includes(orderRow.status)
            ) {
              const e = new Error('Order is not eligible for split-bill payment')
              e.statusCode = 409
              throw e
            }

            // activeSplitAmount — ORM default (paranoid) scope already
            // excludes soft-deleted/cancelled rows.
            const activeSplitAmount =
              (await db.split_bill.sum('amount', {
                where: { order },
                transaction: t
              })) || 0
            const newSplitAmount = items.reduce((sum, i) => sum + Number(i.amount), 0)

            // Multiple creation rounds are intentionally allowed — this
            // replaces the old "any pending split blocks a new create()"
            // gate, which is strictly more restrictive than necessary
            // now that the real invariant (never exceed the order total)
            // is enforced directly.
            if (activeSplitAmount + newSplitAmount > orderRow.totalPrice) {
              const e = new Error(
                `New split total (${activeSplitAmount + newSplitAmount}) would exceed the order total (${orderRow.totalPrice})`
              )
              e.statusCode = 409
              throw e
            }

            const createdSplits = []
            for (const item of items) {
              const created = await db.split_bill.create(
                {
                  order,
                  splitNumber: generateSplitNumber(),
                  amount: Number(item.amount),
                  status: 'pending',
                  createdBy,
                  idempotencyKey: idempotencyKey || null
                },
                { transaction: t }
              )
              createdSplits.push(created)
            }
            return createdSplits
          })
        )
      } catch (txError) {
        if (txError.isIdempotentReplay) {
          return res.status(200).json({
            success: true,
            message: 'Split bills already recorded',
            data: txError.existing
          })
        }
        throw txError
      }

      await createAudit(
        req,
        'create',
        'split_bill',
        splits[0]?.id,
        'Created split_bill for order: ' + order
      )

      return res.status(201).json({
        success: true,
        message: 'Success create split bills',
        data: splits
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  async getByOrder(req, res) {
    try {
      const { orderId } = req.params

      // Same IDOR fix as create() — was an unscoped split_bill read keyed
      // only on orderId, leaking another store's split/payment amounts.
      const orderRow = await db.order.findOne({
        where: scalarStoreScope(req, { id: orderId })
      })
      if (!orderRow) {
        return res.status(404).json({ success: false, message: 'Order not found' })
      }

      const splits = await db.split_bill.findAll({
        where: { order: orderId },
        order: [['createdAt', 'DESC']]
      })

      const totalPaid = splits
        .filter((s) => s.status === 'paid')
        .reduce((sum, s) => sum + s.amount, 0)

      const totalPending = splits
        .filter((s) => s.status === 'pending')
        .reduce((sum, s) => sum + s.amount, 0)

      return res.status(200).json({
        success: true,
        message: 'Success get split bills',
        data: {
          splits,
          summary: {
            totalSplits: splits.length,
            totalPaid,
            totalPending
          }
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async pay(req, res) {
    try {
      const result = await withDeadlockRetry(() =>
        db.sequelize.transaction(async (t) => {
          const { id } = req.params
          const { paymentMethod } = req.body

          // Peek (unlocked) purely to learn the parent order id, so the
          // order can be locked FIRST — uniform with create/cancel/merge.
          const peek = await db.split_bill.findByPk(id, { transaction: t })
          if (!peek) {
            const e = new Error('Split bill not found')
            e.statusCode = 404
            throw e
          }

          // Order-first lock — now UNCONDITIONAL for every payment, not
          // just the completing one (previously only locked on the
          // allPaid branch). This is what makes the corrected completion
          // invariant below race-safe against a concurrent cancel() on a
          // sibling split. IDOR fix (preserved) via scalarStoreScope.
          const order = await db.order.findOne({
            where: scalarStoreScope(req, { id: peek.order }),
            lock: t.LOCK.UPDATE,
            transaction: t
          })
          if (!order) {
            const e = new Error('Split bill not found')
            e.statusCode = 404
            throw e
          }

          // Lock every split row for this order (not just the one being
          // paid), sorted — needed to evaluate the completion invariant
          // race-safely: two different splits paid at the same instant
          // would otherwise each read the other as still 'pending'.
          const allSplits = await db.split_bill.findAll({
            where: { order: order.id },
            order: [['id', 'ASC']],
            lock: t.LOCK.UPDATE,
            transaction: t
          })
          const split = allSplits.find((s) => s.id === Number(id))
          if (!split) {
            const e = new Error('Split bill not found')
            e.statusCode = 404
            throw e
          }
          if (split.status === 'paid') {
            const e = new Error('Split bill already paid')
            e.statusCode = 409
            throw e
          }

          await split.update({ status: 'paid', paymentMethod }, { transaction: t })

          // Every split payment is its own real payment — recorded on
          // the payment ledger as it happens. This row is what F4's
          // totalCollected and F2's cashSalesReceived already sum
          // generically; no split-specific calculation is introduced.
          await db.transaction.create(
            {
              order: split.order,
              typePayment: paymentMethod || 'cash',
              amount: Number(split.amount) || 0,
              notes: `Split bill payment: ${split.splitNumber}`,
              createdBy: req.user?.id || null
            },
            { transaction: t }
          )

          // Authoritative completion invariant, recomputed fresh under
          // the still-held order lock. `allSplits` already reflects
          // `split`'s just-committed status change (same object
          // reference — Sequelize's .update() mutates in place). This
          // replaces the old, insufficient `every(status==='paid')`
          // check — that check alone could not detect an order whose
          // active split total no longer matches order.totalPrice
          // (e.g. after a sibling was cancelled), which is exactly the
          // P0 this hardening closes.
          const activeSplitAmount = allSplits.reduce((sum, s) => sum + Number(s.amount), 0)
          const paidSplitAmount = allSplits
            .filter((s) => s.status === 'paid')
            .reduce((sum, s) => sum + Number(s.amount), 0)
          const everyActivePaid = allSplits.every((s) => s.status === 'paid')

          let orderComplete = false
          let accountingJobs = null

          if (
            activeSplitAmount === order.totalPrice &&
            paidSplitAmount === order.totalPrice &&
            everyActivePaid
          ) {
            // Guard against re-running completion if this order was
            // somehow already marked paid via another path, and refuse a
            // cancelled/voided order outright (cancellation sets
            // paymentStatus to 'refunded', never revived here).
            if (order.paymentStatus !== 'paid' && !['cancelled', 'void'].includes(order.status)) {
              await deductStockForPaidOrder(
                order.id,
                order.store,
                order.orderNumber,
                req.user?.id || null,
                t
              )
              await order.update({ status: 'paid', paymentStatus: 'paid' }, { transaction: t })
              if (order.tableId) {
                await db.table.update(
                  { status: 'available' },
                  { where: { id: order.tableId }, transaction: t }
                )
              }
              orderComplete = true

              // F5-3: durable accounting posting, reusing order.js's own
              // outbox helpers instead of calling accountingService
              // directly — the outbox row commits inside this SAME
              // transaction as the stock deduction/order update/ledger
              // row above, so a rollback here leaves no orphan job, and
              // a post-commit posting failure leaves it durably pending
              // for the existing scheduler, exactly like order.js's own
              // two completion paths.
              accountingJobs = await enqueueOrderAccountingJobs(
                order,
                order.store,
                order.orderNumber,
                {
                  subTotal: order.subTotal,
                  discountAmount: order.discountAmount,
                  taxAmount: order.taxAmount,
                  serviceChargeAmount: order.serviceChargeAmount,
                  totalPrice: order.totalPrice
                },
                'split',
                req.user?.id || null,
                t
              )
            } else if (order.paymentStatus === 'paid') {
              // Already completed via another path — still a true "complete".
              orderComplete = true
            }
            // If the order was cancelled/voided, orderComplete stays
            // false: every active split is paid and the amounts match,
            // but the order itself was not (and must not be) revived.
          }

          return { split, orderComplete, accountingJobs }
        })
      )

      await createAudit(
        req,
        'update',
        'split_bill',
        result.split.id,
        'Updated split_bill: ' + result.split.id
      )

      // Best-effort immediate attempt, after commit — never rolls back
      // an already-valid paid order on posting failure; the outbox row
      // committed above remains durably pending either way.
      if (result.accountingJobs) {
        await attemptOrderAccountingEntries(result.accountingJobs)
      }

      return res.status(200).json({
        success: true,
        message: 'Success pay split bill',
        data: {
          split: result.split,
          orderComplete: result.orderComplete
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  async cancel(req, res) {
    try {
      const cancelledSplit = await withDeadlockRetry(() =>
        db.sequelize.transaction(async (t) => {
          const { id } = req.params

          // Peek (unlocked) purely to learn the parent order id, so the
          // order can be locked FIRST — was split-before-order; now
          // uniform with create/pay/merge.
          const peek = await db.split_bill.findByPk(id, { transaction: t })
          if (!peek) {
            const e = new Error('Split bill not found')
            e.statusCode = 404
            throw e
          }

          // Order-first lock. Cancellation itself is unconditionally
          // allowed for a pending split (this lock never gates the
          // decision) — it exists purely to serialize this cancellation
          // against a concurrent pay()'s completion evaluation on a
          // sibling split. IDOR fix (preserved) via scalarStoreScope.
          const orderRow = await db.order.findOne({
            where: scalarStoreScope(req, { id: peek.order }),
            lock: t.LOCK.UPDATE,
            transaction: t
          })
          if (!orderRow) {
            const e = new Error('Split bill not found')
            e.statusCode = 404
            throw e
          }

          // Authoritative, locked re-read of the target split, now that
          // the order lock is held.
          const split = await db.split_bill.findOne({
            where: { id, order: orderRow.id },
            lock: t.LOCK.UPDATE,
            transaction: t
          })
          if (!split) {
            const e = new Error('Split bill not found')
            e.statusCode = 404
            throw e
          }

          // A paid split is a completed payment with its own ledger
          // entry — deleting it would silently erase that from
          // getByOrder's totals with no reversal of the order's
          // paymentStatus. Only a still-pending split can be cancelled.
          // Cancellation is allowed even if it leaves the active split
          // total below order.totalPrice — that temporary undercoverage
          // is intentional; a replacement split may be created later.
          if (split.status === 'paid') {
            const e = new Error('Cannot cancel a split bill that has already been paid')
            e.statusCode = 409
            throw e
          }

          await split.destroy({ transaction: t })
          return split
        })
      )

      await createAudit(
        req,
        'delete',
        'split_bill',
        cancelledSplit.id,
        'Deleted split_bill: ' + cancelledSplit.id
      )

      return res.status(200).json({
        success: true,
        message: 'Success cancel split bill'
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  async merge(req, res) {
    try {
      const newSplit = await withDeadlockRetry(() =>
        db.sequelize.transaction(async (t) => {
          const { order, splitIds } = req.body

          if (!splitIds || splitIds.length < 2) {
            const e = new Error('At least 2 split bills required to merge')
            e.statusCode = 400
            throw e
          }

          // Order-first lock — was an unlocked verify-only read; now
          // uniform with create/cancel/pay. IDOR fix (preserved): `order`
          // is client-supplied and must be proven to belong to the
          // caller's store before touching any split_bill row.
          const orderRow = await db.order.findOne({
            where: scalarStoreScope(req, { id: order }),
            lock: t.LOCK.UPDATE,
            transaction: t
          })
          if (!orderRow) {
            const e = new Error('Order not found')
            e.statusCode = 404
            throw e
          }

          // Sorted, locked read of exactly the rows being merged.
          const sortedIds = [...splitIds].sort((a, b) => a - b)
          const splits = await db.split_bill.findAll({
            where: {
              id: { [Op.in]: sortedIds },
              order: orderRow.id,
              status: 'pending'
            },
            order: [['id', 'ASC']],
            lock: t.LOCK.UPDATE,
            transaction: t
          })

          if (splits.length !== splitIds.length) {
            const e = new Error('Some split bills not found or already paid')
            e.statusCode = 400
            throw e
          }

          const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0)

          await db.split_bill.destroy({
            where: { id: { [Op.in]: sortedIds } },
            transaction: t
          })

          const created = await db.split_bill.create(
            {
              order: orderRow.id,
              splitNumber: generateSplitNumber(),
              amount: totalAmount,
              status: 'pending'
            },
            { transaction: t }
          )

          return created
        })
      )

      await createAudit(
        req,
        'update',
        'split_bill',
        newSplit.id,
        'Merged split_bill: ' + newSplit.id
      )

      return res.status(201).json({
        success: true,
        message: 'Success merge split bills',
        data: newSplit
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  }
}

module.exports = splitBillController
