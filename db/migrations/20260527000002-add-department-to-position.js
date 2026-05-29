'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('position')
    if (!table.department) {
      await queryInterface.addColumn('position', 'department', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('position', 'department')
  }
}
