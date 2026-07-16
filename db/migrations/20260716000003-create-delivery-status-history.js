'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_status_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      deliveryOrder: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'delivery_order', key: 'id' },
        onDelete: 'CASCADE'
      },
      status: {
        allowNull: false,
        type: Sequelize.STRING(20)
      },
      notes: {
        type: Sequelize.TEXT
      },
      changedBy: {
        type: Sequelize.INTEGER
      },
      changedByName: {
        type: Sequelize.STRING
      },
      locationLat: {
        type: Sequelize.DECIMAL(10, 7)
      },
      locationLng: {
        type: Sequelize.DECIMAL(10, 7)
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
      }
    })

    await queryInterface.addIndex('delivery_status_history', ['deliveryOrder'])
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('delivery_status_history')
  }
}
