'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'business_trip_budget_item'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) {
      await queryInterface.createTable('business_trip_budget_item', {
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
        komponen: { type: Sequelize.STRING },
        qty: { type: Sequelize.DECIMAL(15, 2) },
        satuan: { type: Sequelize.STRING },
        tarif: { type: Sequelize.DECIMAL(15, 2) },
        total: { type: Sequelize.DECIMAL(15, 2) },
        catatan: { type: Sequelize.STRING },
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

      await queryInterface.addIndex('business_trip_budget_item', ['tripId'])
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('business_trip_budget_item')
  }
}
