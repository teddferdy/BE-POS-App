'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('goods_receipt_item', 'ingredientName', {
      allowNull: true,
      type: Sequelize.STRING
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('goods_receipt_item', 'ingredientName')
  }
}
