'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_product') IS NOT NULL AS exists`
    )
    if (!tableCheck[0].exists) return

    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'supplier_product' AND table_schema = 'public'
       ORDER BY ordinal_position`
    )
    const existingCols = colCheck.map((c) => c.column_name)

    if (!existingCols.includes('unit')) {
      await queryInterface.addColumn('supplier_product', 'unit', {
        type: Sequelize.STRING(20),
        defaultValue: 'pcs'
      })
    }

    if (!existingCols.includes('leadTimeUnit')) {
      await queryInterface.addColumn('supplier_product', 'leadTimeUnit', {
        type: Sequelize.STRING(10),
        defaultValue: 'hari'
      })
    }

    if (!existingCols.includes('notes')) {
      await queryInterface.addColumn('supplier_product', 'notes', {
        type: Sequelize.TEXT,
        allowNull: true
      })
    }
  },

  async down(queryInterface) {
    const cols = ['unit', 'leadTimeUnit', 'notes']
    for (const col of cols) {
      const [check] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'supplier_product' AND column_name = '${col}' AND table_schema = 'public'`
      )
      if (check.length > 0) {
        await queryInterface.removeColumn('supplier_product', col)
      }
    }
  }
}
