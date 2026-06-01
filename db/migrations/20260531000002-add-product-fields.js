'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('product', 'sku', {
      type: Sequelize.STRING,
      unique: true
    })
    await queryInterface.addColumn('product', 'barcode', {
      type: Sequelize.STRING
    })
    await queryInterface.addColumn('product', 'brand', {
      type: Sequelize.STRING
    })
    await queryInterface.addColumn('product', 'point', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('product', 'point')
    await queryInterface.removeColumn('product', 'brand')
    await queryInterface.removeColumn('product', 'barcode')
    await queryInterface.removeColumn('product', 'sku')
  }
}
