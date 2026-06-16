'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('product', 'redeemPoints', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product', 'redeemPoints')
  }
}
