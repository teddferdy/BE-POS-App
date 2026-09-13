'use strict'

const columns = [
  { table: 'order', column: 'subTotal' },
  { table: 'order', column: 'discountAmount' },
  { table: 'order', column: 'taxAmount' },
  { table: 'order', column: 'serviceChargeAmount' },
  { table: 'order', column: 'totalPrice' },
  { table: 'transaction', column: 'amount' },
  { table: 'transaction', column: 'cashReceived' },
  { table: 'transaction', column: 'changeGiven' },
  { table: 'order_item', column: 'price' },
  { table: 'order_item', column: 'discountAmount' },
  { table: 'order_item', column: 'totalPrice' }
]

module.exports = {
  async up(queryInterface) {
    for (const { table, column } of columns) {
      const [col] = await queryInterface.sequelize.query(
        `SELECT data_type FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      )
      if (!col) continue
      if (col.data_type === 'bigint') continue
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE BIGINT USING "${column}"::bigint`
      )
    }
  },

  async down(queryInterface) {
    for (const { table, column } of columns) {
      const [col] = await queryInterface.sequelize.query(
        `SELECT data_type FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      )
      if (!col) continue
      if (col.data_type === 'integer') continue
      // Guarded rollback: only downgrade if values fit in INT4
      const [maxRow] = await queryInterface.sequelize.query(
        `SELECT MAX("${column}") AS max FROM "${table}"`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      )
      if (maxRow && maxRow.max !== null && Number(maxRow.max) > 2147483647) {
        throw new Error(`Cannot downgrade ${table}.${column}: value ${maxRow.max} exceeds INT4 max`)
      }
      const [minRow] = await queryInterface.sequelize.query(
        `SELECT MIN("${column}") AS min FROM "${table}"`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      )
      if (minRow && minRow.min !== null && Number(minRow.min) < -2147483648) {
        throw new Error(`Cannot downgrade ${table}.${column}: value ${minRow.min} below INT4 min`)
      }
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE INTEGER USING "${column}"::integer`
      )
    }
  }
}
