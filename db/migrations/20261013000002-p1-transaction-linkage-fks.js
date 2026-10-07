'use strict'

// PAYMENT P1 Register & Settlement Attribution — M2 linkage hardening.
//
// Adds the missing FK integrity layer for the three transaction linkage
// columns. All constraints are introduced NOT VALID so no legacy row is
// validated, scanned at length, or rewritten:
//
//   transaction.cashRegisterId  -> cash_register.id  ON UPDATE CASCADE ON DELETE SET NULL
//   transaction.splitBillId     -> split_bill.id      ON UPDATE CASCADE ON DELETE SET NULL
//   transaction.salesReturnId   -> sales_return.id    ON UPDATE CASCADE ON DELETE RESTRICT
//
// SET NULL (never CASCADE) on the first two: retiring/deleting a split plan
// or a register row must never delete immutable ledger history. RESTRICT on
// salesReturnId matches the existing sales_return.order RESTRICT discipline:
// a return with ledger rows cannot disappear beneath them.
//
// Fail-closed orphan preflight: if ANY transaction row references a
// non-existent cash_register / split_bill / sales_return id, the migration
// aborts BEFORE creating any constraint and reports the exact blocker.
// Orphans are never deleted, rewritten, or nulled here — that would mutate
// financial history. Resolve the data first, then re-run.
//
// Also adds the missing transaction(salesReturnId) lookup index.

const FK_DDLS = [
  `ALTER TABLE "transaction" ADD CONSTRAINT "transaction_cashregister_fkey"
   FOREIGN KEY ("cashRegisterId") REFERENCES "cash_register" (id)
   ON UPDATE CASCADE ON DELETE SET NULL NOT VALID`,
  `ALTER TABLE "transaction" ADD CONSTRAINT "transaction_splitbill_fkey"
   FOREIGN KEY ("splitBillId") REFERENCES "split_bill" (id)
   ON UPDATE CASCADE ON DELETE SET NULL NOT VALID`,
  `ALTER TABLE "transaction" ADD CONSTRAINT "transaction_salesreturn_fkey"
   FOREIGN KEY ("salesReturnId") REFERENCES "sales_return" (id)
   ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID`
]

const FK_NAMES = [
  'transaction_cashregister_fkey',
  'transaction_splitbill_fkey',
  'transaction_salesreturn_fkey'
]

const ORPHAN_CHECKS = [
  ['cashRegisterId', 'cash_register'],
  ['splitBillId', 'split_bill'],
  ['salesReturnId', 'sales_return']
]

module.exports = {
  up: async (queryInterface) => {
    // Pre-migration integrity check — fail safely rather than constraining
    // over orphaned references. Same discipline as the split-bill
    // hardening migration (fail-closed SELECT + throw before DDL).
    for (const [column, target] of ORPHAN_CHECKS) {
      const [orphans] = await queryInterface.sequelize.query(
        `SELECT t.id, t."${column}" AS ref FROM "transaction" t
         WHERE t."${column}" IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM "${target}" r WHERE r.id = t."${column}")`
      )
      if (orphans.length > 0) {
        throw new Error(
          `Migration BLOCKED: ${orphans.length} transaction row(s) reference non-existent ${target} id(s) via "${column}" ` +
            `(transaction ids: ${orphans.map((r) => r.id).join(',')}). ` +
            `Resolve the orphan linkage without deleting or rewriting ledger history, then re-run.`
        )
      }
    }

    await queryInterface.sequelize.transaction(async (t) => {
      for (let i = 0; i < FK_DDLS.length; i++) {
        await queryInterface.sequelize.query(
          `DO $$ BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${FK_NAMES[i]}') THEN
               ${FK_DDLS[i]};
             END IF;
           END $$;`,
          { transaction: t }
        )
      }
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS transaction_salesreturnid ON "transaction" ("salesReturnId")',
        { transaction: t }
      )
    })
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS transaction_salesreturnid', {
        transaction: t
      })
      for (const name of [...FK_NAMES].reverse()) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "${name}"`,
          { transaction: t }
        )
      }
    })
  }
}
