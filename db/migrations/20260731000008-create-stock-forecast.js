'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('stock_forecast', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      product: { type: Sequelize.INTEGER, allowNull: false },
      store: { type: Sequelize.INTEGER, allowNull: false },
      current_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      daily_consumption_rate: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
      lead_time_days: { type: Sequelize.INTEGER, allowNull: true },
      safety_stock: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      reorder_point: { type: Sequelize.INTEGER, allowNull: true },
      forecasted_stockout_date: { type: Sequelize.DATEONLY, allowNull: true },
      forecast_date: { type: Sequelize.DATEONLY, allowNull: false },
      confidence_level: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      notes: { type: Sequelize.TEXT }
    })
    await queryInterface.addIndex('stock_forecast', ['product', 'store'])
    await queryInterface.addIndex('stock_forecast', ['forecast_date'])
    await queryInterface.addIndex('stock_forecast', ['forecasted_stockout_date'])
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('stock_forecast')
  }
}