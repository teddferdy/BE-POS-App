'use strict'
module.exports = (sequelize, DataTypes) => {
  const stock_transfer_item = sequelize.define(
    'stock_transfer_item',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      stockTransfer: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      product: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      qty: {
        allowNull: false,
        type: DataTypes.INTEGER
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
      modelName: 'stock_transfer_item',
      tableName: 'stock_transfer_item'
    }
  )

  stock_transfer_item.associate = (models) => {
    stock_transfer_item.belongsTo(models.stock_transfer, {
      foreignKey: 'stockTransfer',
      as: 'transfer'
    })
    stock_transfer_item.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
  }

  return stock_transfer_item
}
