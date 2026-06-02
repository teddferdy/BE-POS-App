'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('product', 'currencyId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'currency', key: 'id' },
      onDelete: 'SET NULL'
    })
    await queryInterface.addColumn('product', 'currencyCode', {
      type: Sequelize.STRING(10),
      allowNull: true
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product', 'currencyCode')
    await queryInterface.removeColumn('product', 'currencyId')
  }
}
