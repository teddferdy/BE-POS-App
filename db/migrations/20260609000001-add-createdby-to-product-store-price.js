'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('product_store_price')
    if (!tableInfo.createdBy) {
      await queryInterface.addColumn('product_store_price', 'createdBy', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product_store_price', 'createdBy')
  }
}
