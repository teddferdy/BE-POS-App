'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'purchase_order_item',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      purchaseOrder: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      product: {
        type: DataTypes.INTEGER
      },
      ingredientName: {
        type: DataTypes.STRING
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      total: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      receivedQuantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'purchase_order_item',
      tableName: 'purchase_order_item'
    }
  )
}