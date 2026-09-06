'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('location', 'maxActiveParkedCarts', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
    await queryInterface.addColumn('location', 'parkedCartTtlMinutes', {
      type: Sequelize.INTEGER,
      allowNull: true
    })

    // DB-level backstop, same precedent as
    // 20260904000007-check-stock-non-negative.js: application code always
    // clamps to the code-level default when a value is missing/invalid,
    // but nothing in the schema itself previously prevented a direct
    // write (a raw script, a future settings UI) from persisting 0 or a
    // negative value. Postgres CHECK constraints let NULL through
    // unaffected, so the existing "NULL means use the default" behavior
    // is preserved.
    await queryInterface.sequelize.query(`
      ALTER TABLE "location"
      ADD CONSTRAINT location_max_active_parked_carts_positive
      CHECK ("maxActiveParkedCarts" > 0)
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE "location"
      ADD CONSTRAINT location_parked_cart_ttl_minutes_positive
      CHECK ("parkedCartTtlMinutes" > 0)
    `)
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "location" DROP CONSTRAINT IF EXISTS location_parked_cart_ttl_minutes_positive'
    )
    await queryInterface.sequelize.query(
      'ALTER TABLE "location" DROP CONSTRAINT IF EXISTS location_max_active_parked_carts_positive'
    )
    await queryInterface.removeColumn('location', 'parkedCartTtlMinutes')
    await queryInterface.removeColumn('location', 'maxActiveParkedCarts')
  }
}
