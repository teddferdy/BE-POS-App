'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('production_order', {
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
      productionNo: {
        allowNull: false,
        type: Sequelize.STRING
      },
      productItemId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'product', key: 'id' }
      },
      plannedQty: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      producedQty: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM(
          'draft',
          'planned',
          'in_progress',
          'completed',
          'cancelled'
        ),
        defaultValue: 'draft'
      },
      scheduledDate: {
        type: Sequelize.DATEONLY
      },
      completedDate: {
        type: Sequelize.DATE
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('production_order')
  }
}
