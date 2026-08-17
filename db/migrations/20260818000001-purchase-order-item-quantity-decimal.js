'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('purchase_order_item')
    if (table.quantity && table.quantity.type === 'INTEGER') {
      await queryInterface.changeColumn('purchase_order_item', 'quantity', {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false
      })
    }
    if (table.receivedQuantity && table.receivedQuantity.type === 'INTEGER') {
      await queryInterface.changeColumn('purchase_order_item', 'receivedQuantity', {
        type: Sequelize.DECIMAL(10, 4),
        defaultValue: 0
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('purchase_order_item', 'quantity', {
      type: Sequelize.INTEGER,
      allowNull: false
    })
    await queryInterface.changeColumn('purchase_order_item', 'receivedQuantity', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
  }
}
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('purchase_order_item', 'quantity', {
      type: Sequelize.INTEGER,
      allowNull: false
    })
  }
}
