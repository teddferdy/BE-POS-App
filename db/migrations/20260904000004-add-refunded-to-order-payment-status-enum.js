'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Cancelling a paid order previously left paymentStatus stuck at 'paid'
    // forever (no value existed to represent "was paid, then refunded via
    // cancellation"), which made status:'cancelled' + paymentStatus:'paid'
    // a permanent, contradictory state — and, worse, made re-marking that
    // order 'paid' again skip re-deducting the stock that cancellation had
    // just restored, since the code's only signal for "stock is currently
    // out" is paymentStatus === 'paid'. See api/controller/order.js:
    // updateOrderStatus.
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_order_paymentStatus"
      ADD VALUE IF NOT EXISTS 'refunded'
    `)
  },

  down: async (queryInterface, Sequelize) => {
    // PostgreSQL does not support removing values from ENUMs directly.
    // A full recreation of the column would be needed to revert.
  }
}
