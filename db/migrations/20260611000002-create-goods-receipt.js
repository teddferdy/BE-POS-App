'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('goods_receipt', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' }
      },
      receiptNumber: {
        allowNull: false,
        type: Sequelize.STRING
      },
      purchaseOrderId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'purchase_order', key: 'id' }
      },
      receivedDate: {
        type: Sequelize.DATE
      },
      status: {
        type: Sequelize.ENUM('draft', 'completed', 'cancelled'),
        defaultValue: 'draft'
      },
      notes: {
        type: Sequelize.TEXT
      },
      createdBy: {
        type: Sequelize.INTEGER,
        references: { model: 'user', key: 'id' }
      },
      modifiedBy: {
        type: Sequelize.INTEGER
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

    await queryInterface.createTable('goods_receipt_item', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      goodsReceipt: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'goods_receipt', key: 'id' }
      },
      purchaseOrderItem: {
        type: Sequelize.INTEGER,
        references: { model: 'purchase_order_item', key: 'id' }
      },
      product: {
        type: Sequelize.INTEGER,
        references: { model: 'product', key: 'id' }
      },
      qtyReceived: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      unit: {
        type: Sequelize.STRING,
        defaultValue: 'pcs'
      },
      conditionNotes: {
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('goods_receipt_item')
    await queryInterface.dropTable('goods_receipt')
  }
}
