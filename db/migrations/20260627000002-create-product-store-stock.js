'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_store_stock', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      product: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'product', key: 'id' }
      },
      store: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' }
      },
      stock: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        type: Sequelize.DATE
      }
    })
    await queryInterface.addIndex('product_store_stock', ['product', 'store'], { unique: true })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_store_stock')
  }
}
