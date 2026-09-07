'use strict'

// SEC-007 — non-breaking review hardening.
// Adds a nullable `deviceId` column to product_review plus a partial UNIQUE
// index on (productId, deviceId). Clients MAY send a device id to make review
// submission idempotent (one review per device per product, race-safe via the
// unique index → SQLSTATE 23505). Clients that send none keep the pre-fix
// behavior unchanged.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'product_review'",
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (tables.length === 0) return

    await queryInterface.sequelize.query(
      `ALTER TABLE "product_review" ADD COLUMN IF NOT EXISTS "deviceId" VARCHAR(64)`
    )
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_product_review_device
       ON "product_review" ("productId", "deviceId") WHERE "deviceId" IS NOT NULL`
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_product_review_device`)
    await queryInterface.sequelize.query(
      `ALTER TABLE "product_review" DROP COLUMN IF EXISTS "deviceId"`
    )
  }
}