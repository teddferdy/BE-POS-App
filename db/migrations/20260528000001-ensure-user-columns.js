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
    const tableInfo = await queryInterface.describeTable('user')

    const columns = ['contractDuration', 'endDate', 'monthlySalary', 'dailySalary', 'documents']
    for (const col of columns) {
      if (tableInfo[col]) {
        await queryInterface.removeColumn('user', col)
      }
    }
  }
}
