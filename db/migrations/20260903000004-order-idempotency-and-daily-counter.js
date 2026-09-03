module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Optional client-supplied key so a retried/duplicate checkout submit
    // returns the order already created instead of creating a second one.
    // Nullable + partial unique index: older/unmigrated clients that don't
    // send a key are unaffected, but two requests that DO send the same key
    // for the same store can never both succeed at creating a row.
    await queryInterface.addColumn('order', 'idempotencyKey', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX order_store_idempotencyKey_unique
      ON "order" (store, "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `)

    // Atomic per-store, per-day counter backing generateCustomerNumber —
    // replaces the previous MAX(customerNumber)+1 pattern, which had no
    // lock and no unique constraint, so two concurrent orders at the same
    // store on the same day could receive the same pickup number.
    await queryInterface.createTable('order_daily_counter', {
      store: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false
      },
      counterDate: {
        type: Sequelize.DATEONLY,
        primaryKey: true,
        allowNull: false
      },
      lastValue: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('order_daily_counter')
    await queryInterface.removeIndex('order', 'order_store_idempotencyKey_unique')
    await queryInterface.removeColumn('order', 'idempotencyKey')
  }
}
