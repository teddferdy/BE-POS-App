'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('goods_receipt_item')
    if (table.qtyReceived && table.qtyReceived.type !== 'DECIMAL' && table.qtyReceived.type !== 'NUMERIC') {
      // Preserve decimal quantities contractually supported by purchase_order_item.quantity
      await queryInterface.changeColumn('goods_receipt_item', 'qtyReceived', {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: 0
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('goods_receipt_item')
    if (table.qtyReceived && (table.qtyReceived.type === 'DECIMAL' || table.qtyReceived.type === 'NUMERIC')) {
      // Guarded rollback: only if values fit INTEGER
      const [maxRow] = await queryInterface.sequelize.query(
        `SELECT MAX("qtyReceived") AS max FROM "goods_receipt_item"`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      )
      if (maxRow && maxRow.max !== null && Number(maxRow.max) % 1 !== 0) {
        throw new Error(`Cannot downgrade goods_receipt_item.qtyReceived: fractional value ${maxRow.max} would be lost`)
      }
      await queryInterface.changeColumn('goods_receipt_item', 'qtyReceived', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      })
    }
  }
}
