'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_order', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      orderNumber: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true
      },
      order: {
        type: Sequelize.INTEGER,
        references: { model: 'order', key: 'id' },
        onDelete: 'SET NULL'
      },
      store: {
        type: Sequelize.INTEGER,
        references: { model: 'location', key: 'id' },
        onDelete: 'SET NULL'
      },
      driverId: {
        type: Sequelize.INTEGER,
        references: { model: 'driver', key: 'id' },
        onDelete: 'SET NULL'
      },
      driverName: {
        type: Sequelize.STRING
      },
      customerName: {
        type: Sequelize.STRING
      },
      customerPhone: {
        type: Sequelize.STRING
      },
      deliveryAddress: {
        type: Sequelize.TEXT
      },
      deliveryNotes: {
        type: Sequelize.TEXT
      },
      destinationLat: {
        type: Sequelize.DECIMAL(10, 7)
      },
      destinationLng: {
        type: Sequelize.DECIMAL(10, 7)
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'pending'
      },
      estimatedDeliveryTime: {
        type: Sequelize.DATE
      },
      actualDeliveryTime: {
        type: Sequelize.DATE
      },
      deliveryFee: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      totalDistance: {
        type: Sequelize.DECIMAL(8, 2)
      },
      source: {
        type: Sequelize.STRING(20),
        defaultValue: 'pos'
      },
      cancellationReason: {
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

    await queryInterface.addIndex('delivery_order', ['order'])
    await queryInterface.addIndex('delivery_order', ['store'])
    await queryInterface.addIndex('delivery_order', ['driverId'])
    await queryInterface.addIndex('delivery_order', ['status'])
    await queryInterface.addIndex('delivery_order', ['source'])
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('delivery_order')
  }
}
