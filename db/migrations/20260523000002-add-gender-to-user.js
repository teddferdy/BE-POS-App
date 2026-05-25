'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('user')
    if (!tableInfo.gender) {
      await queryInterface.addColumn('user', 'gender', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user', 'gender')
  }
}
