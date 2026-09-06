'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Pre-migration integrity check — fail safely rather than silently
    // adding a constraint that data doesn't actually satisfy. If this
    // ever finds rows, the migration aborts (throws) and nothing below
    // runs; resolving orphaned financial-history rows is a deliberate,
    // reviewed decision, never an automatic delete/rewrite.
    const [orphanReturns] = await queryInterface.sequelize.query(`
      SELECT sr.id FROM sales_return sr
      LEFT JOIN "order" o ON o.id = sr."order"
      WHERE o.id IS NULL
    `)
    if (orphanReturns.length > 0) {
      throw new Error(
        `Migration aborted: ${orphanReturns.length} sales_return row(s) reference a nonexistent order (ids: ${orphanReturns.map((r) => r.id).join(',')}). Resolve before adding the FK.`
      )
    }

    const [orphanItems] = await queryInterface.sequelize.query(`
      SELECT sri.id FROM sales_return_item sri
      LEFT JOIN product p ON p.id = sri.product
      WHERE p.id IS NULL
    `)
    if (orphanItems.length > 0) {
      throw new Error(
        `Migration aborted: ${orphanItems.length} sales_return_item row(s) reference a nonexistent product (ids: ${orphanItems.map((r) => r.id).join(',')}). Resolve before tightening the FK.`
      )
    }

    const [nullStatus] = await queryInterface.sequelize.query(`
      SELECT id FROM sales_return WHERE status IS NULL
    `)
    if (nullStatus.length > 0) {
      throw new Error(
        `Migration aborted: ${nullStatus.length} sales_return row(s) have a NULL status. Resolve before adding NOT NULL.`
      )
    }

    // sales_return.order — no FK existed at all previously.
    await queryInterface.addConstraint('sales_return', {
      fields: ['order'],
      type: 'foreign key',
      name: 'sales_return_order_fkey',
      references: { table: 'order', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    })

    // Raw ALTER rather than changeColumn+ENUM redeclare — avoids any risk
    // of Sequelize attempting to recreate the existing enum type just to
    // flip a nullability flag.
    await queryInterface.sequelize.query(
      'ALTER TABLE "sales_return" ALTER COLUMN "status" SET NOT NULL'
    )

    // sales_return_item.product — tighten from the existing CASCADE
    // (a product delete would otherwise silently destroy return history).
    await queryInterface.removeConstraint(
      'sales_return_item',
      'sales_return_item_product_fkey'
    )
    await queryInterface.addConstraint('sales_return_item', {
      fields: ['product'],
      type: 'foreign key',
      name: 'sales_return_item_product_fkey',
      references: { table: 'product', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    })

    // Approval metadata + idempotency.
    await queryInterface.addColumn('sales_return', 'approvedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'user', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })
    await queryInterface.addColumn('sales_return', 'approvedAt', {
      type: Sequelize.DATE,
      allowNull: true
    })
    await queryInterface.addColumn('sales_return', 'refundReference', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('sales_return', 'idempotencyKey', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX sales_return_order_idempotencykey_unique
      ON sales_return ("order", "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS sales_return_order_idempotencykey_unique'
    )
    await queryInterface.removeColumn('sales_return', 'idempotencyKey')
    await queryInterface.removeColumn('sales_return', 'refundReference')
    await queryInterface.removeColumn('sales_return', 'approvedAt')
    await queryInterface.removeColumn('sales_return', 'approvedBy')

    await queryInterface.removeConstraint(
      'sales_return_item',
      'sales_return_item_product_fkey'
    )
    await queryInterface.addConstraint('sales_return_item', {
      fields: ['product'],
      type: 'foreign key',
      name: 'sales_return_item_product_fkey',
      references: { table: 'product', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    })

    await queryInterface.sequelize.query(
      'ALTER TABLE "sales_return" ALTER COLUMN "status" DROP NOT NULL'
    )

    await queryInterface.removeConstraint('sales_return', 'sales_return_order_fkey')
  }
}
