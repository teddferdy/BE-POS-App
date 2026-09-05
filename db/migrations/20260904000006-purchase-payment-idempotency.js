module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Optional client-supplied key so a retried/duplicate "record payment"
    // submit returns the payment already created instead of creating a
    // second one. Nullable + partial unique index: same pattern as
    // order.idempotencyKey (20260903000004-order-idempotency-and-daily-counter.js).
    await queryInterface.addColumn('purchase_payment', 'idempotencyKey', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX purchase_payment_po_idempotencyKey_unique
      ON "purchase_payment" ("purchaseOrder", "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS purchase_payment_po_idempotencyKey_unique'
    )
    await queryInterface.removeColumn('purchase_payment', 'idempotencyKey')
  }
}
