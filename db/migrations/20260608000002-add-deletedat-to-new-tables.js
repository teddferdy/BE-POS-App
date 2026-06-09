'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_report', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true
    })
    await queryInterface.addColumn('station_dapur', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('daily_report', 'deletedAt')
    await queryInterface.removeColumn('station_dapur', 'deletedAt')
  }
}
