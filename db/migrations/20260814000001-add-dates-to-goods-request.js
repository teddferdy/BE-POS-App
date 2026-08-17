'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('goods_request')
    if (!tableInfo.requestDate) {
      await queryInterface.addColumn('goods_request', 'requestDate', {
        type: Sequelize.DATEONLY,
        allowNull: true
      })
    }
    if (!tableInfo.neededDate) {
      await queryInterface.addColumn('goods_request', 'neededDate', {
        type: Sequelize.DATEONLY,
        allowNull: true
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('goods_request', 'requestDate')
    await queryInterface.removeColumn('goods_request', 'neededDate')
  }
}
