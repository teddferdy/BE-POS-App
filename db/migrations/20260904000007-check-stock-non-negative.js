module.exports = {
  up: async (queryInterface) => {
    // DB-level backstop: every stock-mutation path in the application has
    // now been reviewed and clamps at 0 with GREATEST(...) in its atomic
    // SQL, but that's application logic — nothing in the schema itself
    // ever prevented a negative value (a bypassed code path, a raw
    // script, a future feature) from being written. NULL is allowed
    // through unaffected (Postgres CHECK constraints don't reject NULL).
    await queryInterface.sequelize.query(`
      ALTER TABLE "product"
      ADD CONSTRAINT product_stock_non_negative CHECK (stock >= 0)
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE "product_store_stock"
      ADD CONSTRAINT product_store_stock_stock_non_negative CHECK (stock >= 0)
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_stock_non_negative'
    )
    await queryInterface.sequelize.query(
      'ALTER TABLE "product_store_stock" DROP CONSTRAINT IF EXISTS product_store_stock_stock_non_negative'
    )
  }
}
