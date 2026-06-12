'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ingredient', 'baseUnit', {
      type: Sequelize.STRING(20),
      defaultValue: 'pcs'
    })
    await queryInterface.addColumn('ingredient', 'conversionFactor', {
      type: Sequelize.FLOAT,
      defaultValue: 1
    })
    await queryInterface.addColumn('product', 'baseUnit', {
      type: Sequelize.STRING(20),
      defaultValue: 'pcs'
    })
    await queryInterface.addColumn('product', 'conversionFactor', {
      type: Sequelize.FLOAT,
      defaultValue: 1
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ingredient', 'baseUnit')
    await queryInterface.removeColumn('ingredient', 'conversionFactor')
    await queryInterface.removeColumn('product', 'baseUnit')
    await queryInterface.removeColumn('product', 'conversionFactor')
  }
}
