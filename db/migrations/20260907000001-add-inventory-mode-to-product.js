'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // F7: explicit fulfillment-strategy flag, deliberately decoupled from
    // BOM existence (a product can have a BOM defined and still be
    // 'stocked', in which case F7's checkout logic must ignore that BOM
    // entirely). Not a Postgres ENUM — matches the lighter STRING(20)
    // convention already used by bom_header.status/ingredient.status in
    // this same domain; allowed values are enforced at the application
    // boundary (model + validation schema), not the database.
    await queryInterface.addColumn('product', 'inventoryMode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'stocked'
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('product', 'inventoryMode')
  }
}
