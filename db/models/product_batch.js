'use strict'
module.exports = (sequelize, DataTypes) => {
  const product_batch = sequelize.define(
    'product_batch',
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
      batchCode: {
        allowNull: false,
        type: DataTypes.STRING
      },
      expiryDate: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      qty: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'product_batch',
      tableName: 'product_batch'
    }
  )

  product_batch.associate = (models) => {
    product_batch.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    product_batch.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return product_batch
}
