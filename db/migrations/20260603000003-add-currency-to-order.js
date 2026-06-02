'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('order', 'currencyId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'currency', key: 'id' },
      onDelete: 'SET NULL'
    })
    await queryInterface.addColumn('order', 'currencyCode', {
      type: Sequelize.STRING(10),
      allowNull: true
    })
    await queryInterface.addColumn('order', 'exchangeRate', {
      type: Sequelize.DECIMAL(18, 6),
      allowNull: true,
      defaultValue: 1.0
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('order', 'exchangeRate')
    await queryInterface.removeColumn('order', 'currencyCode')
    await queryInterface.removeColumn('order', 'currencyId')
  }
}
