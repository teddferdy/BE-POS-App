'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('report_config', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      config: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      createdBy: { type: Sequelize.INTEGER },
      modifiedBy: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    })
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('report_config')
  }
}
