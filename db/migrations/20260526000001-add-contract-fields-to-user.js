'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('user')
    if (!tableInfo.contractDuration) {
      await queryInterface.addColumn('user', 'contractDuration', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }
    if (!tableInfo.endDate) {
      await queryInterface.addColumn('user', 'endDate', {
        type: Sequelize.DATEONLY,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user', 'contractDuration')
    await queryInterface.removeColumn('user', 'endDate')
  }
}
