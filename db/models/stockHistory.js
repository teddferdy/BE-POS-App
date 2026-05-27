'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'stock_history',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      product: {
        type: DataTypes.INTEGER
      },
      ingredientName: {
        type: DataTypes.STRING
      },
      referenceType: {
        allowNull: false,
        type: DataTypes.ENUM(
          'purchase',
          'sale',
          'adjustment',
          'opname',
          'return'
        )
      },
      referenceId: {
        type: DataTypes.INTEGER
      },
      quantityBefore: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      quantityChange: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      quantityAfter: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      notes: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'stock_history',
      tableName: 'stock_history'
    }
  )
}
