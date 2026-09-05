'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // split_bill.order had no foreign key at all — the database would
    // silently accept a split-bill row pointing at a non-existent order,
    // worse than merely lacking a transaction around it. Clean up any
    // pre-existing orphans first (a strict FK add fails if any exist);
    // a split-bill row for an order that doesn't exist has no valid
    // interpretation, so these are deleted rather than migrated forward.
    const [orphans] = await queryInterface.sequelize.query(`
      SELECT sb.id FROM split_bill sb
      WHERE NOT EXISTS (SELECT 1 FROM "order" o WHERE o.id = sb."order")
    `)
    if (orphans.length > 0) {
      await queryInterface.sequelize.query(`
        DELETE FROM split_bill
        WHERE id IN (${orphans.map((r) => r.id).join(',')})
      `)
    }

    await queryInterface.addIndex('split_bill', ['order'])

    // ON DELETE CASCADE to match every other order-child table in this
    // schema (order_item, order_status, transaction) — order rows are
    // soft-deleted (paranoid: true) in normal operation, so this is a
    // consistency backstop for the rare hard-delete path, not something
    // expected to fire routinely.
    await queryInterface.addConstraint('split_bill', {
      fields: ['order'],
      type: 'foreign key',
      name: 'split_bill_order_fkey',
      references: { table: 'order', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('split_bill', 'split_bill_order_fkey')
    await queryInterface.removeIndex('split_bill', ['order'])
  }
}
