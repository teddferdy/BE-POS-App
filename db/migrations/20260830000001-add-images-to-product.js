'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('product')
    if (!desc.images) {
      await queryInterface.addColumn(
        'product',
        'images',
        {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: []
        }
      )
    }
  },

  down: async (queryInterface) => {
    const desc = await queryInterface.describeTable('product')
    if (desc.images) {
      await queryInterface.removeColumn('product', 'images')
    }
  }
}