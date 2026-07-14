'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'invoice_setting'
    const columns = await queryInterface.describeTable(table)

    if (!columns.addressFieldsVisibility) {
      await queryInterface.addColumn(table, 'addressFieldsVisibility', {
        type: Sequelize.TEXT,
        allowNull: true
      })
    }
    if (!columns.memberFieldsVisibility) {
      await queryInterface.addColumn(table, 'memberFieldsVisibility', {
        type: Sequelize.TEXT,
        allowNull: true
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'invoice_setting'
    const columns = await queryInterface.describeTable(table)

    if (columns.addressFieldsVisibility) {
      await queryInterface.removeColumn(table, 'addressFieldsVisibility')
    }
    if (columns.memberFieldsVisibility) {
      await queryInterface.removeColumn(table, 'memberFieldsVisibility')
    }
  }
}
