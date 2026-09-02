'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'business_trip'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) {
      await queryInterface.createTable('business_trip', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        tripNumber: {
          allowNull: false,
          type: Sequelize.STRING,
          unique: true
        },
        store: { type: Sequelize.INTEGER },
        employeeId: { type: Sequelize.INTEGER },
        employeeName: { type: Sequelize.STRING },
        employeePosition: { type: Sequelize.STRING },
        destination: { type: Sequelize.STRING },
        tripPurpose: { type: Sequelize.TEXT },
        departureDate: { type: Sequelize.DATEONLY },
        returnDate: { type: Sequelize.DATEONLY },
        budget: { type: Sequelize.DECIMAL(15, 2) },
        notes: { type: Sequelize.TEXT },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'draft'
        },
        approvedBy: { type: Sequelize.INTEGER },
        approvedAt: { type: Sequelize.DATE },
        createdBy: { type: Sequelize.INTEGER },
        modifiedBy: { type: Sequelize.INTEGER },
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

      await queryInterface.addIndex('business_trip', ['store'])
      await queryInterface.addIndex('business_trip', ['status'])
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('business_trip')
  }
}
