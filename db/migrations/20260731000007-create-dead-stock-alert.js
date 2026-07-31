'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('dead_stock_alert', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      product: { type: Sequelize.INTEGER, allowNull: false },
      store: { type: Sequelize.INTEGER, allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      days_without_sale: { type: Sequelize.INTEGER, allowNull: false },
      last_sale_date: { type: Sequelize.DATEONLY, allowNull: true },
      alert_level: { 
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium'
      },
      alert_status: { 
        type: Sequelize.ENUM('active', 'acknowledged', 'resolved'),
        allowNull: false,
        defaultValue: 'active'
      },
      notes: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
      deletedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('dead_stock_alert', ['product', 'store'])
    await queryInterface.addIndex('dead_stock_alert', ['alert_level'])
    await queryInterface.addIndex('dead_stock_alert', ['alert_status'])
    await queryInterface.addIndex('dead_stock_alert', ['days_without_sale'])
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('dead_stock_alert')
  }
}