'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tax_config', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      store: {
        type: Sequelize.INTEGER
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      rate: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      type: {
        type: Sequelize.ENUM('percentage', 'fixed'),
        defaultValue: 'percentage'
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      description: {
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
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE
      }
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('tax_config')
  }
}
