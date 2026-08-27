'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "shift" ALTER COLUMN "store" TYPE JSONB USING CASE WHEN store IS NULL THEN NULL ELSE to_jsonb(ARRAY[store]) END'
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "shift" ALTER COLUMN "store" TYPE INTEGER USING (store->>0)::integer'
    )
  }
}
