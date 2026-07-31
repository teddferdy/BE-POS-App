'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tableCheck] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_product') IS NOT NULL AS exists`
    )
    if (!tableCheck[0].exists) return

    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'supplier_product' AND column_name = 'minOrderQty' AND table_schema = 'public'`
    )
    if (colCheck.length > 0 && colCheck[0].data_type !== 'character varying') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "supplier_product" ALTER COLUMN "minOrderQty" TYPE VARCHAR(50) USING "minOrderQty"::VARCHAR`
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE "supplier_product" ALTER COLUMN "minOrderQty" SET DEFAULT '1'`
      )
    }
  },

  async down(queryInterface, Sequelize) {
    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'supplier_product' AND column_name = 'minOrderQty' AND table_schema = 'public'`
    )
    if (colCheck.length > 0 && colCheck[0].data_type === 'character varying') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "supplier_product" ALTER COLUMN "minOrderQty" TYPE INTEGER USING NULLIF("minOrderQty", '')::INTEGER`
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE "supplier_product" ALTER COLUMN "minOrderQty" SET DEFAULT 1`
      )
    }
  }
}
