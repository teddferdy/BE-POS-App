'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sales_return', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'order', key: 'id' }
      },
      store: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' }
      },
      returnNumber: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      reason: {
        type: Sequelize.TEXT
      },
      returnedBy: {
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

    await queryInterface.createTable('sales_return_item', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      salesReturn: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'sales_return', key: 'id' }
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
    await queryInterface.dropTable('sales_return_item')
    await queryInterface.dropTable('sales_return')
  }
}
