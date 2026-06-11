'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reservation', {
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
      tableId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'table', key: 'id' }
      },
      customerName: {
        allowNull: false,
        type: Sequelize.STRING
      },
      customerPhone: {
        type: Sequelize.STRING
      },
      customerEmail: {
        type: Sequelize.STRING,
        allowNull: true
      },
      guestCount: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      reservationDate: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      startTime: {
        allowNull: false,
        type: Sequelize.TIME
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show'),
        defaultValue: 'pending'
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reservation')
  }
}
