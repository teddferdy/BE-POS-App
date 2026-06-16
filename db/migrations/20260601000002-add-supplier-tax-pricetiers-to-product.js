'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('product')

    if (!table.supplier) {
      await queryInterface.addColumn('product', 'supplier', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }

    if (!table.tax) {
      await queryInterface.addColumn('product', 'tax', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null
      })
    }

    if (!table.priceTiers) {
      await queryInterface.addColumn('product', 'priceTiers', {
        type: Sequelize.JSONB,
        defaultValue: []
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('product')

    if (table.priceTiers) {
      await queryInterface.removeColumn('product', 'priceTiers')
    }

    if (table.tax) {
      await queryInterface.removeColumn('product', 'tax')
    }

    if (table.supplier) {
      await queryInterface.removeColumn('product', 'supplier')
    }
  }
}
