'use strict'
module.exports = (sequelize, DataTypes) => {
  const account = sequelize.define(
    'account',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      code: {
        allowNull: false,
        type: DataTypes.STRING(20)
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      type: {
        allowNull: false,
        type: DataTypes.ENUM(
          'asset',
          'liability',
          'equity',
          'revenue',
          'expense'
        )
      },
      normalBalance: {
        allowNull: false,
        type: DataTypes.ENUM('debit', 'credit')
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'account',
      tableName: 'account',
      indexes: [{ unique: true, fields: ['store', 'code'] }]
    }
  )
  return account
}
