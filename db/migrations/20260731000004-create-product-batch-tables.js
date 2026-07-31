'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('product_batch', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      product: { type: Sequelize.INTEGER, allowNull: false },
      batch_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      received_date: { type: Sequelize.DATEONLY, allowNull: false },
      expiry_date: { type: Sequelize.DATEONLY, allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      received_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cost_per_unit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      supplier: { type: Sequelize.INTEGER, allowNull: true },
      status: { 
        type: Sequelize.ENUM('active', 'quarantine', 'recalled', 'disposed'),
        allowNull: false,
        defaultValue: 'active'
      },
      quality_status: {
        type: Sequelize.ENUM('passed', 'failed', 'pending'),
        allowNull: true,
        defaultValue: 'pending'
      },
      notes: { type: Sequelize.TEXT },
      createdBy: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('product_batch', ['product'])
    await queryInterface.addIndex('product_batch', ['batch_number'])
    await queryInterface.addIndex('product_batch', ['expiry_date'])
    await queryInterface.addIndex('product_batch', ['supplier'])
    await queryInterface.addIndex('product_batch', ['status'])

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
      updatedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('product_batch_stock', ['batch'])
    await queryInterface.addIndex('product_batch_stock', ['store'])
    await queryInterface.addIndex('product_batch_stock', ['batch', 'store'], { unique: true })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('product_batch_stock')
    await queryInterface.dropTable('product_batch')
  }
}