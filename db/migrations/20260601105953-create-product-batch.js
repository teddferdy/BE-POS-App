'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_batch', {
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
      batchCode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      expiryDate: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      qty: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' }
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdBy: {
        type: Sequelize.INTEGER,
        references: { model: 'user', key: 'id' }
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_batch')
  }
}
