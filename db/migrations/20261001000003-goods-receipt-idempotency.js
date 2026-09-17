'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('goods_receipt')
    if (!table.idempotencyKey) {
      await queryInterface.addColumn('goods_receipt', 'idempotencyKey', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }
    // Partial unique index: same pattern as purchase_payment
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS goods_receipt_po_idempotency_unique
      ON "goods_receipt" ("purchaseOrderId", "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `)
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS goods_receipt_po_idempotency_unique'
    )
    const table = await queryInterface.describeTable('goods_receipt')
    if (table.idempotencyKey) {
      await queryInterface.removeColumn('goods_receipt', 'idempotencyKey')
    }
  }
}
