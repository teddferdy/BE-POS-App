'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'stock_opname_item',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      stockOpname: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      product: {
        type: DataTypes.INTEGER
      },
      ingredientName: {
        type: DataTypes.STRING
      },
      systemStock: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      actualStock: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      adjustment: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      notes: {
        type: DataTypes.TEXT
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'stock_opname_item',
      tableName: 'stock_opname_item'
    }
  )
}
