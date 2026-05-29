'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('position')
    if (table.store && table.store.allowNull === false) {
      await queryInterface.changeColumn('position', 'store', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('position', 'store', {
      type: Sequelize.INTEGER,
      allowNull: false
    })
  }
}
