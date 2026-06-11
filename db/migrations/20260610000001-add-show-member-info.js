'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'invoice_setting'
    const columns = await queryInterface.describeTable(table)

    if (!columns.showMemberInfo) {
      await queryInterface.addColumn(table, 'showMemberInfo', {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'invoice_setting'
    const columns = await queryInterface.describeTable(table)

    if (columns.showMemberInfo) {
      await queryInterface.removeColumn(table, 'showMemberInfo')
    }
  }
}
