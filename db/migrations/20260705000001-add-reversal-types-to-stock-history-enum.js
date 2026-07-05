'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_stock_history_referenceType"
      ADD VALUE IF NOT EXISTS 'sale_reversal'
    `)
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_stock_history_referenceType"
      ADD VALUE IF NOT EXISTS 'production_reversal'
    `)
  },

  down: async (queryInterface, Sequelize) => {
    // PostgreSQL does not support removing values from ENUMs directly.
    // A full recreation of the column would be needed to revert.
  }
}
