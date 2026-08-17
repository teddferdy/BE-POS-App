'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [exists] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_contact') IS NOT NULL AS exists`
    )
    if (!exists[0].exists) {
      await queryInterface.createTable('supplier_contact', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        supplier: {
          allowNull: false,
          type: Sequelize.INTEGER,
          references: { model: 'supplier', key: 'id' },
          onDelete: 'CASCADE'
        },
        fullName: {
          allowNull: false,
          type: Sequelize.STRING
        },
        position: {
          type: Sequelize.STRING
        },
        email: {
          type: Sequelize.STRING
        },
        phone: {
          type: Sequelize.STRING
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
      await queryInterface.addIndex('supplier_contact', ['supplier'], {
        name: 'supplier_contact_supplier_idx'
      })
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('supplier_contact')
  }
}
