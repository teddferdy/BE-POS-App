'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('queue', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.JSONB
      },
      queueNumber: {
        allowNull: false,
        type: Sequelize.STRING(20)
      },
      customerName: {
        allowNull: false,
        type: Sequelize.STRING
      },
      customerPhone: {
        type: Sequelize.STRING
      },
      partySize: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      priority: {
        type: Sequelize.ENUM('normal', 'vip', 'elderly', 'pregnant', 'disabled'),
        defaultValue: 'normal'
      },
      estimatedWaitMinutes: {
        type: Sequelize.INTEGER
      },
      actualWaitMinutes: {
        type: Sequelize.INTEGER
      },
      tableId: {
        type: Sequelize.INTEGER
      },
      notes: {
        type: Sequelize.TEXT
      },
      status: {
        type: Sequelize.ENUM('waiting', 'seated', 'cancelled', 'no_show', 'expired'),
        defaultValue: 'waiting'
      },
      checkedInAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      seatedAt: {
        type: Sequelize.DATE
      },
      cancelledAt: {
        type: Sequelize.DATE
      },
      assignedTo: {
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

    await queryInterface.addIndex('queue', ['store'], {
      using: 'GIN',
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('queue', ['status'], {
      where: { deletedAt: null }
    })

    await queryInterface.addIndex('queue', ['queueNumber'], {
      unique: true,
      where: { deletedAt: null }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('queue')
  }
}
