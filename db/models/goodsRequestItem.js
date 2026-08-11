'use strict'
module.exports = (sequelize, DataTypes) => {
  const goodsRequestItem = sequelize.define(
    'goodsRequestItem',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      goodsRequest: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      product: {
        type: DataTypes.INTEGER
      },
      productName: {
        type: DataTypes.STRING
      },
      ingredient: {
        type: DataTypes.INTEGER
      },
      ingredientName: {
        type: DataTypes.STRING
      },
      supplier: {
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
      modelName: 'goodsRequestItem',
      tableName: 'goods_request_item'
    }
  )

  goodsRequestItem.associate = (models) => {
    goodsRequestItem.belongsTo(models.goodsRequest, {
      foreignKey: 'goodsRequest',
      as: 'request'
    })
    goodsRequestItem.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    goodsRequestItem.belongsTo(models.ingredient, {
      foreignKey: 'ingredient',
      as: 'ingredientData'
    })
    goodsRequestItem.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
  }

  return goodsRequestItem
}
