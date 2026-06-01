'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "product" ALTER COLUMN "store" TYPE JSONB USING to_jsonb(store)'
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "product" ALTER COLUMN "store" TYPE INTEGER USING (store->>0)::integer'
    )
  }
}
