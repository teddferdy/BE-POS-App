'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bom_header', 'status', {
      type: Sequelize.STRING(20),
      defaultValue: 'active'
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bom_header', 'status')
  }
}
