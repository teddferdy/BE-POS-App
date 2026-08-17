'use strict'
module.exports = (sequelize, DataTypes) => {
  const product_batch_stock = sequelize.define(
    'product_batch_stock',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      batch: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      reserved_quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      allocated_quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unit_cost: {
        allowNull: true,
        type: DataTypes.DECIMAL(15, 2)
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'product_batch_stock',
      tableName: 'product_batch_stock',
      indexes: [
        { fields: ['batch'] },
        { fields: ['store'] },
        { fields: ['batch', 'store'], unique: true }
      ]
    }
  )

  product_batch_stock.associate = (models) => {
    product_batch_stock.belongsTo(models.product_batch, {
      foreignKey: 'batch',
      as: 'batchData'
    })
    product_batch_stock.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return product_batch_stock
}
