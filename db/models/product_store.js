'use strict'
module.exports = (sequelize, DataTypes) => {
  const product_store = sequelize.define(
    'product_store',
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
      modelName: 'product_store',
      tableName: 'product_store',
      indexes: [
        {
          unique: true,
          fields: ['product', 'store']
        }
      ]
    }
  )

  product_store.associate = (models) => {
    product_store.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    product_store.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return product_store
}
