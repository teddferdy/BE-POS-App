'use strict'
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('product', 'tipeProduk', {
      type: Sequelize.STRING(20),
      defaultValue: 'menu',
      allowNull: false
    })
    await queryInterface.addColumn('product', 'hppPerPorsi', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0
    })
    await queryInterface.addColumn('product', 'foodCostPersen', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0
    })
    await queryInterface.addColumn('product', 'marginPersen', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0
    })
    await queryInterface.addColumn('product', 'isAvailableHariIni', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product', 'isAvailableHariIni')
    await queryInterface.removeColumn('product', 'marginPersen')
    await queryInterface.removeColumn('product', 'foodCostPersen')
    await queryInterface.removeColumn('product', 'hppPerPorsi')
    await queryInterface.removeColumn('product', 'tipeProduk')
  }
}
