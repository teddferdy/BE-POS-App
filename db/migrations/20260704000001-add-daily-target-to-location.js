'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('location', 'dailyTarget', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'dailyTarget')
  }
}
