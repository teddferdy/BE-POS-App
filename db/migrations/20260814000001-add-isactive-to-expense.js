'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const expenseDesc = await queryInterface.describeTable('expense')

    if (!expenseDesc.isActive) {
      await queryInterface.addColumn('expense', 'isActive', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('expense', 'isActive')
  }
}
