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
      product: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      price: {
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
      foreignKey: 'product',
      as: 'productData'
    })
  }

  return supplierProduct
}
