'use strict'
module.exports = (sequelize, DataTypes) => {
  const product_store_stock = sequelize.define(
    'product_store_stock',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      product: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      stock: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'product_store_stock',
      tableName: 'product_store_stock'
    }
  )

  product_store_stock.associate = (models) => {
    product_store_stock.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    product_store_stock.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return product_store_stock
}
