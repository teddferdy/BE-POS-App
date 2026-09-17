'use strict'

const columns = [
  { table: 'product', column: 'stock' },
  { table: 'ingredient', column: 'stock' },
  { table: 'product_store_stock', column: 'stock' },
  { table: 'stock_history', column: 'quantityBefore' },
  { table: 'stock_history', column: 'quantityChange' },
  { table: 'stock_history', column: 'quantityAfter' }
]

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const { table, column } of columns) {
      const tbl = await queryInterface.describeTable(table)
      if (!tbl[column]) continue
      const type = String(tbl[column].type || '').toUpperCase()
      // Already DECIMAL/NUMERIC -> skip
      if (type.includes('DECIMAL') || type.includes('NUMERIC')) continue
      await queryInterface.changeColumn(table, column, {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: tbl[column].allowNull,
        defaultValue: tbl[column].defaultValue
      })
    }
    // Preserve CHECK constraints for product and product_store_stock (stock >=0) if missing after type change
    // Sequelize changeColumn may drop CHECK; re-add if not exists
    const checks = await queryInterface.sequelize.query(
      `SELECT conname FROM pg_constraint WHERE conrelid='product'::regclass AND contype='c'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    )
    const hasProductCheck = checks.some((r) => r.conname === 'product_stock_non_negative')
    if (!hasProductCheck) {
      try {
        await queryInterface.sequelize.query(`ALTER TABLE product ADD CONSTRAINT product_stock_non_negative CHECK (stock >= 0)`)
      } catch {}
    }
    const checks2 = await queryInterface.sequelize.query(
      `SELECT conname FROM pg_constraint WHERE conrelid='product_store_stock'::regclass AND contype='c'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    )
    const hasPssCheck = checks2.some((r) => r.conname === 'product_store_stock_stock_non_negative')
    if (!hasPssCheck) {
      try {
        await queryInterface.sequelize.query(`ALTER TABLE product_store_stock ADD CONSTRAINT product_store_stock_stock_non_negative CHECK (stock >= 0)`)
      } catch {}
    }
  },

  async down(queryInterface, Sequelize) {
    for (const { table, column } of columns) {
      const tbl = await queryInterface.describeTable(table)
      if (!tbl[column]) continue
      const type = String(tbl[column].type || '').toUpperCase()
      if (type.includes('INTEGER')) continue
      // Fail safe if fractional values exist
      const [row] = await queryInterface.sequelize.query(
        `SELECT MAX("${column}"::text::decimal % 1) AS frac FROM "${table}" WHERE "${column}" IS NOT NULL`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      )
      // Simple check: if any fractional part !=0, abort
      const [fracCheck] = await queryInterface.sequelize.query(
        `SELECT 1 FROM "${table}" WHERE "${column}"::text ~ '\\.' AND ("${column}"::text::decimal % 1) != 0 LIMIT 1`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      )
      if (fracCheck) {
        throw new Error(`Cannot downgrade ${table}.${column}: fractional values would be lost`)
      }
      await queryInterface.changeColumn(table, column, {
        type: Sequelize.INTEGER,
        allowNull: tbl[column].allowNull,
        defaultValue: tbl[column].defaultValue
      })
    }
  }
}
