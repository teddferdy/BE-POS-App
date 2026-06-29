'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('location')
    if (!table.city) {
      await queryInterface.addColumn('location', 'city', {
        type: Sequelize.STRING
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'city')
  }
}
