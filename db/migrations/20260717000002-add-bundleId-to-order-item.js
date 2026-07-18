'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('order_item', 'bundleId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'product_bundle', key: 'id' }
    })

    await queryInterface.addColumn('order_item', 'bundleName', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addIndex('order_item', ['bundleId'], {
      where: { deletedAt: null }
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('order_item', ['bundleId'])
    await queryInterface.removeColumn('order_item', 'bundleName')
    await queryInterface.removeColumn('order_item', 'bundleId')
  }
}
