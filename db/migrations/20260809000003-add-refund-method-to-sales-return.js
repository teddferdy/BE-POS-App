'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sales_return', 'refundMethod', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'cash'
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sales_return', 'refundMethod')
  }
}
