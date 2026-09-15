'use strict'

// Phase 22 Batch 4 — AP Reminder Scheduler + Notification Foundation.
//
// Turns the Batch 3 due-date classification into idempotent AP reminder
// events. Deliberately does NOT duplicate the AP outstanding calculation
// (purchase_order.finalAmount - Σpurchase_payment.amount, exactly as
// purchasePayment.js's apDashboard() already computes it) and does NOT
// duplicate the classification rule (utils/businessDate.js's
// classifyDueDate() is the single authoritative source, reused verbatim
// here, called from BE only — never reimplemented in FE or here).
//
// Idempotency: a plain `INSERT ... ON CONFLICT DO NOTHING` against
// ap_reminder_event's unique (store, purchaseOrder, classification,
// businessDate) index — the same raw-SQL upsert idiom already used
// throughout this codebase (e.g. product_store_stock's atomic upsert in
// pos.js) rather than a read-then-write check, so two overlapping
// scheduler ticks (or two app instances) racing on the same PO can only
// ever have one of them win the insert; the loser sees 0 rows affected
// and treats it as "already generated", not an error.

const db = require('../../db/models')
const { Op } = require('sequelize')
const { getStoreLocalDate, getDaysUntilDue, classifyDueDate } = require('../../utils/businessDate')
const { createNotification } = require('../../utils/createNotification')

// Section 7: UPCOMING (> H-4) never generates a reminder. Fully paid
// (outstanding <= 0), cancelled/draft POs, and POs without a dueDate are
// excluded upstream (query filter / outstanding check), never reaching
// this set at all.
const REMINDER_ELIGIBLE_CLASSIFICATIONS = new Set([
  'H-4',
  'H-3',
  'H-2',
  'H-1',
  'DUE_TODAY',
  'OVERDUE'
])

/**
 * Evaluate outstanding, dueDate-bearing purchase orders and generate at
 * most one ap_reminder_event (+ notification) per (store, PO,
 * classification, businessDate). Safe to call repeatedly — every call
 * after the first for the same business event is a no-op.
 *
 * @param {object} [options]
 * @param {Date} [options.now] - injectable for deterministic tests
 * @param {number} [options.limit] - bounds the per-run PO scan, same
 *   fairness/backlog reasoning as expenseScheduler's MAX_TEMPLATES_PER_TICK
 * @returns {Promise<{evaluated:number, eligible:number, created:number, skippedDuplicate:number}>}
 */
async function generateApReminders({ now = new Date(), limit = 200 } = {}) {
  const result = { evaluated: 0, eligible: 0, created: 0, skippedDuplicate: 0 }

  const purchaseOrders = await db.purchase_order.findAll({
    where: {
      status: { [Op.notIn]: ['cancelled', 'draft'] },
      dueDate: { [Op.ne]: null }
    },
    include: [
      { model: db.purchase_payment, as: 'payments', attributes: ['amount'] },
      { model: db.location, as: 'storeData', attributes: ['id', 'timezone'] }
    ],
    order: [['dueDate', 'ASC']],
    limit
  })

  for (const po of purchaseOrders) {
    result.evaluated += 1
    if (!po.store) continue

    const paid = (po.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const outstanding = (Number(po.finalAmount) || 0) - paid
    if (outstanding <= 0) continue

    const timezone = po.storeData?.timezone
    const daysUntilDue = getDaysUntilDue(po.dueDate, timezone, now)
    const classification = classifyDueDate(daysUntilDue)
    if (!classification || !REMINDER_ELIGIBLE_CLASSIFICATIONS.has(classification)) continue

    result.eligible += 1
    const businessDate = getStoreLocalDate(timezone, now)

    const inserted = await db.sequelize.query(
      `INSERT INTO ap_reminder_event (store, "purchaseOrder", classification, "businessDate", "createdAt", "updatedAt")
       VALUES (:store, :purchaseOrder, :classification, :businessDate, NOW(), NOW())
       ON CONFLICT (store, "purchaseOrder", classification, "businessDate") DO NOTHING
       RETURNING id`,
      {
        replacements: {
          store: po.store,
          purchaseOrder: po.id,
          classification,
          businessDate
        },
        type: db.sequelize.QueryTypes.SELECT
      }
    )

    if (inserted.length === 0) {
      result.skippedDuplicate += 1
      continue
    }

    result.created += 1
    const eventId = inserted[0].id

    // Delivery is best-effort, same accepted risk profile as every other
    // fire-and-forget notification/journal call in this codebase (Batch
    // 1 finding F22-B1-01) — the ledger row above is the durable, already-
    // committed fact that this event happened; a failure here just means
    // the user-visible notification didn't get created this attempt, not
    // that the event will be silently regenerated (the unique index
    // already prevents that regardless of what happens next).
    try {
      const notification = await createNotification({
        type: 'ap_reminder',
        store: po.store,
        referenceId: po.id,
        referenceType: 'purchase_order',
        params: [po.orderNumber, classification, outstanding]
      })
      if (notification) {
        await db.ap_reminder_event.update(
          { notificationId: notification.id },
          { where: { id: eventId } }
        )
      }
    } catch (err) {
      console.error('AP reminder notification delivery failed:', err.message)
    }
  }

  return result
}

module.exports = { generateApReminders, REMINDER_ELIGIBLE_CLASSIFICATIONS }
