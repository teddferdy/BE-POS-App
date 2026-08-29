'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [tables] = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.product') IS NOT NULL AS exists"
    )
    if (!tables[0].exists) return

    const [cols] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'product' AND table_schema = 'public'`
    )
    const existing = cols.map((c) => c.column_name)

    if (!existing.includes('images')) {
      await queryInterface.addColumn('product', 'images', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: []
      })
    }
  },

  down: async (queryInterface) => {
    const [cols] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'product' AND table_schema = 'public'`
    )
    const existing = cols.map((c) => c.column_name)
    if (existing.includes('images')) {
      await queryInterface.removeColumn('product', 'images')
    }
  }
}