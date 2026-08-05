'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('waiter_request', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.JSONB
      },
      requestNumber: {
        allowNull: false,
        type: Sequelize.STRING(20)
      },
      tableId: {
        type: Sequelize.INTEGER
      },
      orderId: {
        type: Sequelize.INTEGER
      },
      type: {
        allowNull: false,
        type: Sequelize.ENUM('sendok', 'tisu', 'refill', 'bill', 'call')
      },
      notes: {
        type: Sequelize.TEXT
      },
      customerName: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'done'),
        defaultValue: 'pending'
      },
      resolvedAt: {
        type: Sequelize.DATE
      },
      resolvedBy: {
        type: Sequelize.INTEGER
      },
      createdBy: {
        type: Sequelize.INTEGER
      },
      modifiedBy: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deletedAt: {
        type: Sequelize.DATE
      }
    })

    await queryInterface.addIndex('waiter_request', ['store'], {
      using: 'GIN',
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('waiter_request', ['status'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('waiter_request', ['requestNumber'], {
      unique: true,
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('waiter_request')
  }
}
