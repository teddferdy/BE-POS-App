'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('supplier_performance', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      supplier: { type: Sequelize.INTEGER, allowNull: false },
      month: { type: Sequelize.DATEONLY, allowNull: false },
      total_orders: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      on_time_deliveries: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      late_deliveries: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      damaged_items: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      correct_items: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      avg_lead_time_days: { type: Sequelize.DECIMAL(5, 2) },
      total_value: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      total_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      score: { type: Sequelize.DECIMAL(5, 2) },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
      deletedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('supplier_performance', ['supplier'])
    await queryInterface.addIndex('supplier_performance', ['month'])
    await queryInterface.addIndex('supplier_performance', ['supplier', 'month'], { unique: true })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('supplier_performance')
  }
}