'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('transaction', 'cashReceived', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
    await queryInterface.addColumn('transaction', 'changeGiven', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    })
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('transaction', 'changeGiven')
    await queryInterface.removeColumn('transaction', 'cashReceived')
  }
}
