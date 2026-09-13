'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('order')
    if (!table.redeemedPoints) {
      await queryInterface.addColumn('order', 'redeemedPoints', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      })
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('order')
    if (table.redeemedPoints) {
      await queryInterface.removeColumn('order', 'redeemedPoints')
    }
  }
}
