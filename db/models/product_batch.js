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
      batch_number: {
        allowNull: false,
        type: DataTypes.STRING(50),
        unique: true
      },
      received_date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      expiry_date: {
        allowNull: true,
        type: DataTypes.DATEONLY
      },
      quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      received_quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      cost_per_unit: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      supplier: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      status: {
        allowNull: false,
        type: DataTypes.ENUM('active', 'quarantine', 'recalled', 'disposed'),
        defaultValue: 'active'
      },
      quality_status: {
        allowNull: true,
        type: DataTypes.ENUM('passed', 'failed', 'pending'),
        defaultValue: 'pending'
      },
      notes: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'product_batch',
      tableName: 'product_batch',
      indexes: [
        { fields: ['product'] },
        { fields: ['batch_number'], unique: true },
        { fields: ['expiry_date'] },
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