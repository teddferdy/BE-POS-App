'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.changeColumn('order', 'cashierId', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    } catch (err) {
      console.log('Error altering cashierId:', err.message)
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.changeColumn('order', 'cashierId', {
        type: Sequelize.INTEGER,
        allowNull: false
      })
    } catch (err) {
      console.log('Error reverting cashierId:', err.message)
    }
  }
}
