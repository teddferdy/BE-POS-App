'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_return', 'documentation', {
      allowNull: true,
      type: Sequelize.TEXT
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('purchase_return', 'documentation')
  }
}
