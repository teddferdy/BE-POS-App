'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'shift_template'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) {
      await queryInterface.createTable('shift_template', {
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
        startTime: {
          allowNull: false,
          type: Sequelize.TIME
        },
        endTime: {
          allowNull: false,
          type: Sequelize.TIME
        },
        description: {
          type: Sequelize.STRING
        },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'active'
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
      })
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('shift_template')
  }
}
