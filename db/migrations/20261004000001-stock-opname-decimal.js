'use strict'

// Phase 34 — stock-opname decimal precision remediation.
//
// stock_opname_item's quantity columns were INTEGER, silently rounding any
// fractional physical count for fractional-unit products (kg, gram, liter,
// ml, meter, cm — see utils/unit.js's FRACTIONAL_UNITS) before it ever
// reached product.stock/ingredient.stock, which are already DECIMAL(10,4).
// Business decision: fractional stock-opname quantities are required.
//
// Included: the six primary quantity fields plus the three shadow fields
// (systemStock/actualStock/adjustment) that mirror them 1:1 on every write
// (api/controller/stockOpname.js create/update) — leaving the shadow
// fields INTEGER would silently truncate a decimal stokAkhirJumlah/
// stokFisikJumlah/selisihJumlah the moment it's copied into its shadow
// column, creating a new precision-loss path this same migration would
// otherwise just have closed.
//
// Also included: stock_opname.totalAdjustment (the header table, a
// separate model) — create() unconditionally sums every item's
// selisihJumlah into it on every request; discovered via TDD when a
// negative fractional selisih (a normal case, e.g. -7.5) crashed the
// create endpoint with a raw Postgres "invalid input syntax for type
// integer" error. This is a direct, unavoidable consequence of the same
// fields above, not a separate/unrelated feature.

const columns = [
  { table: 'stock_opname_item', column: 'stokAwalJumlah' },
  { table: 'stock_opname_item', column: 'barangMasukJumlah' },
  { table: 'stock_opname_item', column: 'barangKeluarJumlah' },
  { table: 'stock_opname_item', column: 'stokAkhirJumlah' },
  { table: 'stock_opname_item', column: 'stokFisikJumlah' },
  { table: 'stock_opname_item', column: 'selisihJumlah' },
  { table: 'stock_opname_item', column: 'systemStock' },
  { table: 'stock_opname_item', column: 'actualStock' },
  { table: 'stock_opname_item', column: 'adjustment' },
  { table: 'stock_opname', column: 'totalAdjustment' }
]

module.exports = {
  async up(queryInterface, Sequelize) {
    const described = {}
    for (const { table, column } of columns) {
      described[table] = described[table] || (await queryInterface.describeTable(table))
      const tbl = described[table]
      if (!tbl[column]) continue
      const type = String(tbl[column].type || '').toUpperCase()
      // Already DECIMAL/NUMERIC -> skip (idempotent re-run safety)
      if (type.includes('DECIMAL') || type.includes('NUMERIC')) continue
      await queryInterface.changeColumn(table, column, {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: tbl[column].allowNull,
        defaultValue: tbl[column].defaultValue
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const described = {}
    for (const { table, column } of columns) {
      described[table] = described[table] || (await queryInterface.describeTable(table))
      const tbl = described[table]
      if (!tbl[column]) continue
      const type = String(tbl[column].type || '').toUpperCase()
      if (type.includes('INTEGER')) continue
      // Fail safe if fractional values exist — never silently truncate on
      // rollback (same guard as 20261002000001-fractional-stock-decimal.js).
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
