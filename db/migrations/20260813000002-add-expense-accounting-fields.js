'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const expenseDesc = await queryInterface.describeTable('expense')
    const categoryDesc = await queryInterface.describeTable('expense_category')

    if (!expenseDesc.payee) {
      await queryInterface.addColumn('expense', 'payee', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }

    if (!categoryDesc.accountCode) {
      await queryInterface.addColumn('expense_category', 'accountCode', {
        type: Sequelize.STRING(20),
        allowNull: true
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('expense_category', 'accountCode')
    await queryInterface.removeColumn('expense', 'payee')
  }
}
