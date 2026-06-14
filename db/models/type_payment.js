'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'type_payment',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      icon: {
        type: DataTypes.STRING
      },
      type: {
        type: DataTypes.ENUM('cash', 'debit', 'credit', 'e-wallet', 'other'),
        defaultValue: 'cash'
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      createdBy: {
        type: DataTypes.STRING
      },
      modifiedBy: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'type_payment',
      tableName: 'type_payment'
    }
  )
}
