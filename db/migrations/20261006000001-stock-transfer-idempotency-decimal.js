'use strict'

// Phase 39 Batch 1 — transfer-send safety.
//
// 1. idempotencyKey on stock_transfer (nullable, client-supplied) with a
//    partial unique index scoped to the source store — the exact pattern
//    already established by purchase_payment (20260904000006) and
//    goods_receipt (20261001000003): same-key retries replay instead of
//    duplicating the transfer + stock deduction, same-key payload changes
//    are rejected, and the fromStore scope prevents cross-store replay.
// 2. stock_transfer_item.qty INTEGER -> DECIMAL(10,4), aligning transfer
//    quantities with the existing DECIMAL stock contract
//    (product_store_stock.stock DECIMAL(10,4), stock_opname_item 20261004000001)
//    so fractional quantities are stored exactly instead of truncated.

module.exports = {
  async up(queryInterface, Sequelize) {
    const transferTable = await queryInterface.describeTable('stock_transfer')
    if (!transferTable.idempotencyKey) {
      await queryInterface.addColumn('stock_transfer', 'idempotencyKey', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS stock_transfer_fromstore_idempotency_unique
      ON "stock_transfer" ("fromStore", "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `)
    const itemTable = await queryInterface.describeTable('stock_transfer_item')
    if (itemTable.qty) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "stock_transfer_item" ALTER COLUMN "qty" TYPE DECIMAL(10,4) USING "qty"::DECIMAL(10,4)
      `)
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS stock_transfer_fromstore_idempotency_unique'
    )
    const transferTable = await queryInterface.describeTable('stock_transfer')
    if (transferTable.idempotencyKey) {
      await queryInterface.removeColumn('stock_transfer', 'idempotencyKey')
    }
    await queryInterface.sequelize.query(`
      ALTER TABLE "stock_transfer_item" ALTER COLUMN "qty" TYPE INTEGER USING "qty"::INTEGER
    `)
  }
}
