'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('user')
    if (!tableInfo.monthlySalary) {
      await queryInterface.addColumn('user', 'monthlySalary', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      })
    }
    if (!tableInfo.dailySalary) {
      await queryInterface.addColumn('user', 'dailySalary', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      })
    }
    if (!tableInfo.documents) {
      await queryInterface.addColumn('user', 'documents', {
        type: Sequelize.TEXT,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user', 'monthlySalary')
    await queryInterface.removeColumn('user', 'dailySalary')
    await queryInterface.removeColumn('user', 'documents')
  }
}
