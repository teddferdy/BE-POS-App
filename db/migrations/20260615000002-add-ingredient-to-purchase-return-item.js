'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_return_item', 'ingredient', {
      allowNull: true,
      type: Sequelize.INTEGER,
      references: { model: 'ingredient', key: 'id' }
    })

    await queryInterface.changeColumn('purchase_return_item', 'product', {
      allowNull: true,
      type: Sequelize.INTEGER,
      references: { model: 'product', key: 'id' }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('purchase_return_item', 'ingredient')

    await queryInterface.changeColumn('purchase_return_item', 'product', {
      allowNull: false,
      type: Sequelize.INTEGER,
      references: { model: 'product', key: 'id' }
    })
  }
}
