'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_transfer', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      transferNumber: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true
      },
      fromStore: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' }
      },
      toStore: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' }
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      notes: {
        type: Sequelize.TEXT
      },
      transferredBy: {
        type: Sequelize.STRING
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

    await queryInterface.createTable('stock_transfer_item', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      stockTransfer: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'stock_transfer', key: 'id' }
      },
      product: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'product', key: 'id' }
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('stock_transfer_item')
    await queryInterface.dropTable('stock_transfer')
  }
}
