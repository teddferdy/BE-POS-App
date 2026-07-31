'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('product_batch')
    const addCol = async (col, def) => {
      if (!table[col]) {
        await queryInterface.addColumn('product_batch', col, def)
      }
    }

    await addCol('received_date', { type: Sequelize.DATEONLY, allowNull: true })
    await addCol('received_quantity', { type: Sequelize.INTEGER, defaultValue: 0 })
    await addCol('cost_per_unit', { type: Sequelize.INTEGER, defaultValue: 0 })
    await addCol('supplier', { type: Sequelize.INTEGER, allowNull: true })
    await addCol('quality_status', {
      type: Sequelize.ENUM('passed', 'failed', 'pending'),
      allowNull: true,
      defaultValue: 'pending'
    })
    await addCol('notes', { type: Sequelize.TEXT, allowNull: true })

    await queryInterface.createTable('product_batch_stock', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      batch: { type: Sequelize.INTEGER, allowNull: false },
      store: { type: Sequelize.INTEGER, allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reserved_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      allocated_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      unit_cost: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
      deletedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('product_batch_stock', ['batch'])
    await queryInterface.addIndex('product_batch_stock', ['store'])
    await queryInterface.addIndex('product_batch_stock', ['batch', 'store'], { unique: true })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('product_batch_stock')
    await queryInterface.removeColumn('product_batch', 'notes')
    await queryInterface.removeColumn('product_batch', 'quality_status')
    await queryInterface.removeColumn('product_batch', 'supplier')
    await queryInterface.removeColumn('product_batch', 'cost_per_unit')
    await queryInterface.removeColumn('product_batch', 'received_quantity')
    await queryInterface.removeColumn('product_batch', 'received_date')
  }
}