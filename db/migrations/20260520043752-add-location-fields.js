'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('location')
    if (!table.province) {
      await queryInterface.addColumn('location', 'province', {
        type: Sequelize.STRING
      })
    }
    if (!table.district) {
      await queryInterface.addColumn('location', 'district', {
        type: Sequelize.STRING
      })
    }
    if (!table.postalCode) {
      await queryInterface.addColumn('location', 'postalCode', {
        type: Sequelize.STRING
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'province')
    await queryInterface.removeColumn('location', 'district')
    await queryInterface.removeColumn('location', 'postalCode')
  }
}
