'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('goods_request', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      requestNumber: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true
      },
      store: {
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' }
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        defaultValue: 'pending'
      },
      requestedBy: {
        type: Sequelize.STRING
      },
      notes: {
        type: Sequelize.TEXT
      },
      approvedBy: {
        type: Sequelize.INTEGER,
        references: { model: 'user', key: 'id' }
      },
      approvedAt: {
        type: Sequelize.DATE
      },
      purchaseOrderId: {
        type: Sequelize.INTEGER,
        references: { model: 'purchase_order', key: 'id' }
      },
      createdBy: {
        type: Sequelize.INTEGER,
        references: { model: 'user', key: 'id' }
      },
      modifiedBy: {
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

    await queryInterface.createTable('goods_request_item', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      goodsRequest: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'goods_request', key: 'id' }
      },
      product: {
        type: Sequelize.INTEGER,
        references: { model: 'product', key: 'id' }
      },
      productName: {
        type: Sequelize.STRING
      },
      ingredient: {
        type: Sequelize.INTEGER,
        references: { model: 'ingredient', key: 'id' }
      },
      ingredientName: {
        type: Sequelize.STRING
      },
      supplier: {
        type: Sequelize.INTEGER,
        references: { model: 'supplier', key: 'id' }
      },
      qty: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      unit: {
        type: Sequelize.STRING,
        defaultValue: 'pcs'
      },
      notes: {
        type: Sequelize.TEXT
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

    await queryInterface.addIndex('goods_request', ['store'])
    await queryInterface.addIndex('goods_request', ['status'])
    await queryInterface.addIndex('goods_request_item', ['goodsRequest'])
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('goods_request_item')
    await queryInterface.dropTable('goods_request')
  }
}
