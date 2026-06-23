'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('ingredient_category', 'store', {
      type: Sequelize.JSON
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('ingredient_category', 'store', {
      type: Sequelize.INTEGER
    })
  }
}
