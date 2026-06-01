'use strict'
module.exports = (sequelize, DataTypes) => {
  const product_store_price = sequelize.define(
    'product_store_price',
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
      price: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'product_store_price',
      tableName: 'product_store_price',
      indexes: [
        {
          unique: true,
          fields: ['product', 'store']
        }
      ]
    }
  )

  product_store_price.associate = (models) => {
    product_store_price.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    product_store_price.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return product_store_price
}
