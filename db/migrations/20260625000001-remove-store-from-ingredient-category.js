'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ingredient_category', 'store')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ingredient_category', 'store', {
      type: Sequelize.JSON,
      defaultValue: null,
      allowNull: true
    })
  }
}
