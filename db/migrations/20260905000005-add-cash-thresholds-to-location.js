'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('location', 'cashOutApprovalThreshold', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
    await queryInterface.addColumn('location', 'cashVarianceThreshold', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('location', 'cashVarianceThreshold')
    await queryInterface.removeColumn('location', 'cashOutApprovalThreshold')
  }
}
