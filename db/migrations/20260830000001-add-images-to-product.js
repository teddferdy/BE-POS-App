'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'product',
      'images',
      {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: []
      }
    )
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('product', 'images')
  }
}