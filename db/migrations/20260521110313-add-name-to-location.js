'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('location')
    if (!table.name) {
      await queryInterface.addColumn('location', 'name', {
        type: Sequelize.STRING
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'name')
  }
}
