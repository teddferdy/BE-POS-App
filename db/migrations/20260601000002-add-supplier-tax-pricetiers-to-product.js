'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('product', 'supplier', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
    await queryInterface.addColumn('product', 'tax', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null
    })
    await queryInterface.addColumn('product', 'priceTiers', {
      type: Sequelize.JSONB,
      defaultValue: []
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('product', 'priceTiers')
    await queryInterface.removeColumn('product', 'tax')
    await queryInterface.removeColumn('product', 'supplier')
  }
}
