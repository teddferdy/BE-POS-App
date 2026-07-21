'use strict'
module.exports = (sequelize, DataTypes) => {
  const supplierProduct = sequelize.define(
    'supplier_product',
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
      productId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      name: {
        allowNull: false,
        type: DataTypes.TEXT
      },
      price: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      leadTime: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      qualityRating: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      minOrderQty: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      lastPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0
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
      modelName: 'supplier_product',
      tableName: 'supplier_product'
    }
  )

  supplierProduct.associate = (models) => {
    supplierProduct.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
    supplierProduct.belongsTo(models.product, {
      foreignKey: 'productId',
      as: 'productData'
    })
  }

  return supplierProduct
}
