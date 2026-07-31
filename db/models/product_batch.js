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
      },
      received_date: {
        type: DataTypes.DATEONLY
      },
      received_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      cost_per_unit: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      supplier: {
        type: DataTypes.INTEGER
      },
      quality_status: {
        type: DataTypes.ENUM('passed', 'failed', 'pending'),
        defaultValue: 'pending'
      },
      notes: {
        type: DataTypes.TEXT
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'product_batch',
      tableName: 'product_batch',
      indexes: [
        { fields: ['product'] },
        { fields: ['expiryDate'] },
        { fields: ['supplier'] },
        { fields: ['status'] }
      ]
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
    product_batch.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
    product_batch.hasMany(models.product_batch_stock, {
      foreignKey: 'batch',
      as: 'stocks'
    })
  }

  return product_batch
}