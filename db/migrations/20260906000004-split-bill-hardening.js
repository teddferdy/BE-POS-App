'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Pre-migration integrity check — fail safely rather than silently
    // coercing existing data. Same discipline as F4's
    // sales-return-financial-integrity migration.
    const [nullStatus] = await queryInterface.sequelize.query(
      'SELECT id FROM split_bill WHERE status IS NULL'
    )
    if (nullStatus.length > 0) {
      throw new Error(
        `Migration aborted: ${nullStatus.length} split_bill row(s) have a NULL status (ids: ${nullStatus.map((r) => r.id).join(',')}). Resolve before adding NOT NULL.`
      )
    }

    await queryInterface.sequelize.query(
      'ALTER TABLE "split_bill" ALTER COLUMN "status" SET NOT NULL'
    )

    // Create-retry idempotency — scoped (order, idempotencyKey). Unlike
    // F4's one-key-per-row shape, a single split-bill idempotencyKey
    // legitimately covers MULTIPLE rows at once (every split in one
    // "create a round of N splits" call) — a UNIQUE index on
    // (order, idempotencyKey) would reject the second row of the very
    // same batch. Concurrency safety instead comes from create()'s
    // existing, unconditional order-row lock: two concurrent create()
    // calls for the same order already fully serialize through that
    // lock (the second one blocks until the first commits, then
    // re-checks for an existing idempotencyKey match inside the same
    // transaction) — no DB uniqueness constraint is needed as a
    // backstop here. This index is a plain lookup index only.
    await queryInterface.addColumn('split_bill', 'idempotencyKey', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addIndex('split_bill', {
      name: 'split_bill_order_idempotencykey',
      fields: ['order', 'idempotencyKey']
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('split_bill', 'split_bill_order_idempotencykey')
    await queryInterface.removeColumn('split_bill', 'idempotencyKey')
    await queryInterface.sequelize.query(
      'ALTER TABLE "split_bill" ALTER COLUMN "status" DROP NOT NULL'
    )
  }
}
