'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ingredient_category', 'store_json', {
      type: Sequelize.JSON,
      defaultValue: null,
      allowNull: true
    })
    await queryInterface.sequelize.query(
      `UPDATE ingredient_category SET store_json = CASE WHEN store IS NOT NULL THEN jsonb_build_array(store) ELSE '[]'::jsonb END`
    )
    await queryInterface.removeColumn('ingredient_category', 'store')
    await queryInterface.renameColumn('ingredient_category', 'store_json', 'store')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ingredient_category', 'store_int', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    })
    await queryInterface.sequelize.query(
      `UPDATE ingredient_category SET store_int = (store->>0)::int WHERE store IS NOT NULL AND jsonb_array_length(store) > 0`
    )
    await queryInterface.removeColumn('ingredient_category', 'store')
    await queryInterface.renameColumn('ingredient_category', 'store_int', 'store')
  }
}
