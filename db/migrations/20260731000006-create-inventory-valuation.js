'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('inventory_valuation', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      product: { type: Sequelize.INTEGER, allowNull: false },
      store: { type: Sequelize.INTEGER, allowNull: false },
      valuation_date: { type: Sequelize.DATEONLY, allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_cost: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      average_cost: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      cogs_method: { 
        type: Sequelize.ENUM('FIFO', 'LIFO', 'WEIGHTED_AVERAGE', 'SPECIFIC_ID'), 
        allowNull: false,
        defaultValue: 'FIFO'
      },
      valuation_type: {
        type: Sequelize.ENUM('periodic', 'perpetual'),
        allowNull: false,
        defaultValue: 'perpetual'
      },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE }
    })
    await queryInterface.addIndex('inventory_valuation', ['product', 'store'])
    await queryInterface.addIndex('inventory_valuation', ['valuation_date'])
    await queryInterface.addIndex('inventory_valuation', ['cogs_method'])
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('inventory_valuation')
  }
}