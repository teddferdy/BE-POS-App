'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [exists] = await queryInterface.sequelize.query(
      `SELECT to_regclass('public.supplier_bank_account') IS NOT NULL AS exists`
    )
    if (!exists[0].exists) {
      await queryInterface.createTable('supplier_bank_account', {
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
        bankName: {
          allowNull: false,
          type: Sequelize.STRING
        },
        accountNumber: {
          allowNull: false,
          type: Sequelize.STRING
        },
        accountName: {
          allowNull: false,
          type: Sequelize.STRING
        },
        isDefault: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'active'
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
      await queryInterface.addIndex('supplier_bank_account', ['supplier'], {
        name: 'supplier_bank_account_supplier_idx'
      })
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('supplier_bank_account')
  }
}
