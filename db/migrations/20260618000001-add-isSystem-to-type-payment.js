'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'type_payment'
    const columns = await queryInterface.describeTable(table)

    if (!columns.isSystem) {
      await queryInterface.addColumn(table, 'isSystem', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'type_payment'
    const columns = await queryInterface.describeTable(table)

    if (columns.isSystem) {
      await queryInterface.removeColumn(table, 'isSystem')
    }
  }
}
