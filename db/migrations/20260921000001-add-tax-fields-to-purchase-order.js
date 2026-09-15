'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_order', 'taxRate', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0
    })

    await queryInterface.addColumn('purchase_order', 'taxAmount', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('purchase_order', 'taxAmount')
    await queryInterface.removeColumn('purchase_order', 'taxRate')
  }
}
