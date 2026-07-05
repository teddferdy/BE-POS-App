'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'invoice_setting'
    const columns = await queryInterface.describeTable(table)

    if (!columns.showSocialMedia) {
      await queryInterface.addColumn(table, 'showSocialMedia', {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      })
    }
    if (!columns.socialMediaVisibility) {
      await queryInterface.addColumn(table, 'socialMediaVisibility', {
        type: Sequelize.TEXT,
        allowNull: true
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'invoice_setting'
    const columns = await queryInterface.describeTable(table)

    if (columns.showSocialMedia) {
      await queryInterface.removeColumn(table, 'showSocialMedia')
    }
    if (columns.socialMediaVisibility) {
      await queryInterface.removeColumn(table, 'socialMediaVisibility')
    }
  }
}
