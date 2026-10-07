'use strict'

// PAYMENT P1 Register & Settlement Attribution — M1 transaction attribution.
//
// Adds the two nullable per-record attribution columns required by
// DR-PAY-ATTR-01 (one financial event = one immutable ledger record):
//   transaction.cashRegisterId — receiving/refunding register (MC-4)
//   transaction.splitBillId    — split-plan linkage (event -> plan)
//
// Safety contract (locked):
// - Both columns NULL-able. Legacy rows keep NULL. No backfill, no guessed
//   linkage (notes text is never parsed), no row deletion, no row rewrite.
// - Indexes only; FK constraints arrive in M2 (linkage hardening) so each
//   concern is independently reversible.
// - Fully guarded/idempotent: every statement is IF (NOT) EXISTS, so the
// - migration is safe to re-run and a no-op on already-migrated databases.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query(
        'ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "cashRegisterId" INTEGER',
        { transaction: t }
      )
      await queryInterface.sequelize.query(
        'ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "splitBillId" INTEGER',
        { transaction: t }
      )
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS transaction_cashregisterid ON "transaction" ("cashRegisterId")',
        { transaction: t }
      )
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS transaction_splitbillid ON "transaction" ("splitBillId")',
        { transaction: t }
      )
    })
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS transaction_splitbillid', {
        transaction: t
      })
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS transaction_cashregisterid', {
        transaction: t
      })
      await queryInterface.sequelize.query(
        'ALTER TABLE "transaction" DROP COLUMN IF EXISTS "splitBillId"',
        { transaction: t }
      )
      await queryInterface.sequelize.query(
        'ALTER TABLE "transaction" DROP COLUMN IF EXISTS "cashRegisterId"',
        { transaction: t }
      )
    })
  }
}
