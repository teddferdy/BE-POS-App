'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('location', 'socialMedia', {
      type: Sequelize.JSONB,
      allowNull: true
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('location', 'socialMedia')
  }
}
