'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('location')
    if (!table.openingHours) {
      await queryInterface.addColumn('location', 'openingHours', {
        type: Sequelize.JSONB
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'openingHours')
  }
}
