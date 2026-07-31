'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_order', 'paymentMethod', {
      type: Sequelize.ENUM('cash', 'credit'),
      defaultValue: 'cash'
    })

    await queryInterface.addColumn('purchase_order', 'tenor', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })

    await queryInterface.addColumn('purchase_order', 'dpPercent', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('purchase_order', 'dpPercent')
    await queryInterface.removeColumn('purchase_order', 'tenor')
    await queryInterface.removeColumn('purchase_order', 'paymentMethod')
  }
}
