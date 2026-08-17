'use strict'
module.exports = (sequelize, DataTypes) => {
  const supplier_bank_account = sequelize.define(
    'supplier_bank_account',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      supplier: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      bankName: {
        allowNull: false,
        type: DataTypes.STRING
      },
      accountNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      accountName: {
        allowNull: false,
        type: DataTypes.STRING
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'supplier_bank_account',
      tableName: 'supplier_bank_account'
    }
  )

  supplier_bank_account.associate = (models) => {
    supplier_bank_account.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
  }

  return supplier_bank_account
}
