'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('product')
    if (!tableInfo.composition) {
      await queryInterface.addColumn('product', 'composition', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product', 'composition')
  }
}
