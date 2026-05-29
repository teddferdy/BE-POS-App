'use strict'

const tables = [
  'categories', 'discounts', 'shifts', 'expense_categories', 'suppliers',
  'ingredients', 'member_tiers', 'social_media', 'type_payments', 'sub_categories',
  'tables', 'expenses', 'orders', 'products', 'purchase_orders',
  'stock_histories', 'stock_opnames', 'checkouts', 'members', 'daily_summaries',
  'invoice_footers', 'invoice_logos', 'invoice_social_media', 'cash_registers',
  'locations', 'best_sellings'
]

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of tables) {
      try {
        const desc = await queryInterface.describeTable(table)
        if (desc.store && desc.store.allowNull === false) {
          await queryInterface.changeColumn(table, 'store', {
            type: Sequelize.INTEGER,
            allowNull: true
          })
        }
      } catch (e) {
        console.log(`Skipping ${table}: ${e.message}`)
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    for (const table of tables) {
      try {
        await queryInterface.changeColumn(table, 'store', {
          type: Sequelize.INTEGER,
          allowNull: false
        })
      } catch (e) {
        console.log(`Skipping ${table}: ${e.message}`)
      }
    }
  }
}
