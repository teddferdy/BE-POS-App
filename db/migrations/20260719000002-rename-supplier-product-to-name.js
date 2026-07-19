'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'supplier_product' AND column_name = 'product' AND table_schema = 'public'`
    )
    const hasProductCol = colCheck.length > 0

    if (hasProductCol) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "supplier_product" RENAME COLUMN "product" TO "name"
      `)

      await queryInterface.changeColumn('supplier_product', 'name', {
        type: Sequelize.TEXT,
        allowNull: false
      })

      await queryInterface.sequelize.query(`
        ALTER TABLE "supplier_product" RENAME CONSTRAINT "uq_supplier_product_supplier_product"
        TO "uq_supplier_product_supplier_name"
      `)

      await queryInterface.sequelize.query(`
        UPDATE "supplier_product"
        SET "name" = (
          SELECT p."nameProduct"
          FROM "product" p
          WHERE p.id = "supplier_product"."name"::int
          LIMIT 1
        )
        WHERE "name" ~ '^[0-9]+$'
      `)
    }
  },

  async down(queryInterface, Sequelize) {
    const [colCheck] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'supplier_product' AND column_name = 'name' AND table_schema = 'public'`
    )
    const hasNameCol = colCheck.length > 0

    if (hasNameCol) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "supplier_product" RENAME COLUMN "name" TO "product"
      `)

      await queryInterface.changeColumn('supplier_product', 'product', {
        type: Sequelize.INTEGER,
        allowNull: false
      })

      await queryInterface.sequelize.query(`
        ALTER TABLE "supplier_product" RENAME CONSTRAINT "uq_supplier_product_supplier_name"
        TO "uq_supplier_product_supplier_product"
      `)
    }
  }
}
