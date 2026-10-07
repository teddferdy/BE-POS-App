'use strict'

// PAYMENT P1 Register & Settlement Attribution — M5 closed-register snapshot.
//
// Persists the minimum frozen set required by DR-PAY-ATTR-04 (closed X/Z
// reports are immutable snapshots). Snapshot-design classification (§8):
//
// REQUIRED new persistence (recomputation drifts post-close today):
//   expectedCash      — frozen headline (today derived only, never stored)
//   activeCashIn/Out  — frozen inputs to expectedCash (today derived only)
//   cashRefundsTotal  — cash-only refund leg (today netted invisibly inside
//                       cashSalesReceived, indistinguishable from later sales)
//   refundsTotal/refundCount — all-method refund leg (paid-only gross shrinks
//                       on refund with no compensating frozen line)
//   totalTransactions — gross count (today derived; drifts like totalSales)
//   closeSnapshot JSONB — { gross:{subtotal,discount,tax,serviceCharge,
//                       quantity,covers}, payments:[{type,total,count}],
//                       expenses:[{category,total,count}] }. JSONB (not an
//                       opaque blob): values stay SQL-queryable via ->
//                       operators, matching the totalPayments JSONB precedent;
//                       a single document avoids 15+ scalar columns while the
//                       cash-critical figures above stay scalar for direct
//                       reconciliation queries.
// REUSED, not duplicated (already persisted at close, untouched here):
//   openingBalance, closingBalance, totalSales, cashSalesReceived,
//   totalExpenses, totalPayments, variance (+approval), openedAt, closedAt.
// DERIVED conveniences (stay live, labeled non-authoritative, not frozen):
//   store/cashier names, reconciliation excluded-buckets, outsideWindow,
//   pending-movement display (always 0 once closed).
//
// All columns NULL-able. Historical closed registers keep NULL snapshots,
// classified unreconstructible — never backfilled with recomputed values,
// because recomputation itself is the drifting behavior being frozen out.
// The close/report controllers that populate these columns arrive in the
// later application phase; this migration is schema only.

const COLUMNS = [
  ['expectedCash', 'INTEGER'],
  ['activeCashIn', 'INTEGER'],
  ['activeCashOut', 'INTEGER'],
  ['cashRefundsTotal', 'INTEGER'],
  ['refundsTotal', 'INTEGER'],
  ['refundCount', 'INTEGER'],
  ['totalTransactions', 'INTEGER'],
  ['closeSnapshot', 'JSONB']
]

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      for (const [column, definition] of COLUMNS) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "cash_register" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`,
          { transaction: t }
        )
      }
    })
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      for (const [column] of [...COLUMNS].reverse()) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "cash_register" DROP COLUMN IF EXISTS "${column}"`,
          { transaction: t }
        )
      }
    })
  }
}

module.exports.SNAPSHOT_COLUMNS = COLUMNS.map(([column]) => column)
