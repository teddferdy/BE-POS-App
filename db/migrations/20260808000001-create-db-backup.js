'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('db_backup', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      filename: {
        allowNull: false,
        type: Sequelize.STRING
      },
      filepath: {
        allowNull: false,
        type: Sequelize.STRING
      },
      size: {
        type: Sequelize.BIGINT,
        defaultValue: 0
      },
      format: {
        type: Sequelize.STRING(20),
        defaultValue: 'custom'
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'success'
      },
      trigger: {
        type: Sequelize.STRING(20),
        defaultValue: 'manual'
      },
      store: {
        type: Sequelize.INTEGER
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      createdBy: {
        type: Sequelize.INTEGER
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
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('db_backup');
  }
};
