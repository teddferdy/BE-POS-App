'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'invoice_setting'

    const columns = await queryInterface.describeTable(table)

    if (columns.logoImage) {
      await queryInterface.removeColumn(table, 'logoImage')
    }
    if (columns.showLogo) {
      await queryInterface.removeColumn(table, 'showLogo')
    }
    if (columns.footerText) {
      await queryInterface.removeColumn(table, 'footerText')
    }
    if (columns.showFooter) {
      await queryInterface.removeColumn(table, 'showFooter')
    }
    if (columns.socialMediaList) {
      await queryInterface.removeColumn(table, 'socialMediaList')
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'invoice_setting'

    await queryInterface.addColumn(table, 'logoImage', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn(table, 'showLogo', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })
    await queryInterface.addColumn(table, 'footerText', {
      type: Sequelize.TEXT,
      allowNull: true
    })
    await queryInterface.addColumn(table, 'showFooter', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })
    await queryInterface.addColumn(table, 'socialMediaList', {
      type: Sequelize.TEXT,
      allowNull: true
    })
  }
}
