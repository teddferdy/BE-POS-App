'use strict'

const tables = [
  'category', 'discount', 'shift', 'expense_category', 'supplier',
  'ingredient', 'member_tier', 'social_media', 'type_payment',
  'table', 'expense', 'order', 'product', 'purchase_order',
  'stock_history', 'stock_opname', 'checkout', 'member', 'daily_summary',
  'invoice_footer', 'invoice_logo', 'invoice_social_media', 'cash_register',
  'location', 'best_selling', 'position'
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
          console.log(`Fixed ${table}.store`)
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
