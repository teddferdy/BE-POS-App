'use strict'

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "stock_forecast" ADD COLUMN IF NOT EXISTS "days_until_stockout" INTEGER`
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "stock_forecast" ADD COLUMN IF NOT EXISTS "last_updated" TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
    )
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "stock_forecast" DROP COLUMN IF EXISTS "days_until_stockout"`
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "stock_forecast" DROP COLUMN IF EXISTS "last_updated"`
    )
  }
}
