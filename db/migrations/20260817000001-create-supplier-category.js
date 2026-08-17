'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [exists] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_category') IS NOT NULL AS exists`
    )
    if (!exists[0].exists) {
      await queryInterface.createTable('supplier_category', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        store: {
          type: Sequelize.INTEGER
        },
        name: {
          allowNull: false,
          type: Sequelize.STRING
        },
        description: {
          type: Sequelize.TEXT
        },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'active'
        },
        createdBy: {
          type: Sequelize.INTEGER
        },
        modifiedBy: {
          type: Sequelize.INTEGER
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        deletedAt: {
          type: Sequelize.DATE
        }
      })
      await queryInterface.addIndex('supplier_category', ['name'], {
        name: 'supplier_category_name_idx'
      })
      await queryInterface.addIndex('supplier_category', ['status'], {
        name: 'supplier_category_status_idx'
      })
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('supplier_category')
  }
}
