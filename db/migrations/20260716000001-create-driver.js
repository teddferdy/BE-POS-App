'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('driver', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.JSONB
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      phone: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      vehicleType: {
        type: Sequelize.STRING
      },
      vehiclePlate: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'active'
      },
      currentLat: {
        type: Sequelize.DECIMAL(10, 7)
      },
      currentLng: {
        type: Sequelize.DECIMAL(10, 7)
      },
      notes: {
        type: Sequelize.TEXT
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('driver')
  }
}
