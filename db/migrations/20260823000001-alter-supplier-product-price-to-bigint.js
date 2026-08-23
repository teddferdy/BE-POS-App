'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_product') IS NOT NULL AS exists`
    )
    if (!tableCheck[0].exists) return

    await queryInterface.changeColumn('supplier_product', 'price', {
      type: Sequelize.BIGINT,
      defaultValue: 0
    })
    await queryInterface.changeColumn('supplier_product', 'lastPrice', {
      type: Sequelize.BIGINT,
      defaultValue: 0
    })
  },

  async down(queryInterface, Sequelize) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_product') IS NOT NULL AS exists`
    )
    if (!tableCheck[0].exists) return

    await queryInterface.changeColumn('supplier_product', 'price', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
    await queryInterface.changeColumn('supplier_product', 'lastPrice', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
  }
}
