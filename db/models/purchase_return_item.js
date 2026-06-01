'use strict'
module.exports = (sequelize, DataTypes) => {
  const purchase_return_item = sequelize.define(
    'purchase_return_item',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      purchaseReturn: {
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
      modelName: 'purchase_return_item',
      tableName: 'purchase_return_item'
    }
  )

  purchase_return_item.associate = (models) => {
    purchase_return_item.belongsTo(models.purchase_return, {
      foreignKey: 'purchaseReturn',
      as: 'return'
    })
    purchase_return_item.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
  }

  return purchase_return_item
}
