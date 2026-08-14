'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [exists] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.region') IS NOT NULL AS exists`
    )
    if (!exists[0].exists) return

    const [cols] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'region' AND table_schema = 'public'`
    )
    const existing = cols.map((c) => c.column_name)

    if (!existing.includes('latitude')) {
      await queryInterface.addColumn('region', 'latitude', {
        allowNull: true,
        type: Sequelize.FLOAT
      })
    }
    if (!existing.includes('longitude')) {
      await queryInterface.addColumn('region', 'longitude', {
        allowNull: true,
        type: Sequelize.FLOAT
      })
    }
  },

  down: async (queryInterface) => {
    const [cols] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'region' AND table_schema = 'public'`
    )
    const existing = cols.map((c) => c.column_name)
    if (existing.includes('latitude')) {
      await queryInterface.removeColumn('region', 'latitude')
    }
    if (existing.includes('longitude')) {
      await queryInterface.removeColumn('region', 'longitude')
    }
  }
}
