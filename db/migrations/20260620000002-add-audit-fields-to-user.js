'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('user')
    if (!table.createdBy) {
      await queryInterface.addColumn('user', 'createdBy', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }
    if (!table.modifiedBy) {
      await queryInterface.addColumn('user', 'modifiedBy', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user', 'createdBy')
    await queryInterface.removeColumn('user', 'modifiedBy')
  }
}
