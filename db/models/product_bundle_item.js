'use strict'
module.exports = (sequelize, DataTypes) => {
  const ProductBundleItem = sequelize.define(
    'product_bundle_item',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      bundleId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      product: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      unitPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      isOptional: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
      modelName: 'product_bundle_item',
      tableName: 'product_bundle_item'
    }
  )

  ProductBundleItem.associate = function (models) {
    ProductBundleItem.belongsTo(models.product_bundle, { foreignKey: 'bundleId', as: 'bundle' })
    ProductBundleItem.belongsTo(models.product, { foreignKey: 'product', as: 'productData' })
  }

  return ProductBundleItem
}
