'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add columns to sales_return
    const salesReturnTable = await queryInterface.describeTable('sales_return')
    if (!salesReturnTable.refundAmount) {
      await queryInterface.addColumn('sales_return', 'refundAmount', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      })
    }

    // Add columns to sales_return_item
    const salesReturnItemTable = await queryInterface.describeTable('sales_return_item')
    if (!salesReturnItemTable.orderItem) {
      await queryInterface.addColumn('sales_return_item', 'orderItem', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }
    if (!salesReturnItemTable.price) {
      await queryInterface.addColumn('sales_return_item', 'price', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      })
    }
    if (!salesReturnItemTable.conversionToBase) {
      await queryInterface.addColumn('sales_return_item', 'conversionToBase', {
        type: Sequelize.DECIMAL(10, 4),
        defaultValue: 1
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('sales_return', 'refundAmount')
    await queryInterface.removeColumn('sales_return_item', 'orderItem')
    await queryInterface.removeColumn('sales_return_item', 'price')
    await queryInterface.removeColumn('sales_return_item', 'conversionToBase')
  }
}
