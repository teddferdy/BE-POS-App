'use strict'

const columns = [
  { table: 'purchase_order', column: 'totalAmount' },
  { table: 'purchase_order', column: 'discount' },
  { table: 'purchase_order', column: 'finalAmount' },
  { table: 'purchase_order', column: 'taxAmount' },
  { table: 'purchase_order', column: 'additionalCost' },
  { table: 'purchase_order_item', column: 'price' },
  { table: 'purchase_order_item', column: 'total' },
  { table: 'purchase_payment', column: 'amount' },
  { table: 'goods_receipt_item', column: 'costPrice' },
  { table: 'goods_receipt_item', column: 'landedCost' }
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
