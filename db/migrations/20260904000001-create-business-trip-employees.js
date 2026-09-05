'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'business_trip_employee'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) {
      await queryInterface.createTable('business_trip_employee', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        tripId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        employeeId: { type: Sequelize.INTEGER },
        employeeName: { type: Sequelize.STRING },
        employeePosition: { type: Sequelize.STRING },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        deletedAt: { type: Sequelize.DATE }
      })

      await queryInterface.addIndex('business_trip_employee', ['tripId'])
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('business_trip_employee')
  }
}
