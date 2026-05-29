'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'department'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) {
      await queryInterface.createTable('department', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        name: {
          allowNull: false,
          type: Sequelize.STRING
        },
        description: {
          type: Sequelize.STRING
        },
        status: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        createdBy: {
          type: Sequelize.STRING
        },
        modifiedBy: {
          type: Sequelize.STRING
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
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('department')
  }
}
