'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('member_point_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      member: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'member', key: 'id' }
      },
      pointsChange: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      pointsBefore: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      pointsAfter: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      transactionId: {
        type: Sequelize.STRING
      },
      notes: {
        type: Sequelize.TEXT
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('member_point_history')
  }
}
