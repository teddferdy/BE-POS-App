'use strict'
module.exports = (sequelize, DataTypes) => {
  const dead_stock_alert = sequelize.define(
    'dead_stock_alert',
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
      quantity: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      days_without_sale: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      last_sale_date: {
        allowNull: true,
        type: DataTypes.DATEONLY
      },
      alert_level: {
        allowNull: false,
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium'
      },
      alert_status: {
        allowNull: false,
        type: DataTypes.ENUM('active', 'acknowledged', 'resolved'),
        defaultValue: 'active'
      },
      notes: {
        type: DataTypes.TEXT
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'dead_stock_alert',
      tableName: 'dead_stock_alert',
      indexes: [
        { fields: ['product', 'store'] },
        { fields: ['alert_level'] },
        { fields: ['alert_status'] },
        { fields: ['days_without_sale'] }
      ]
    }
  )

  dead_stock_alert.associate = (models) => {
    dead_stock_alert.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    dead_stock_alert.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return dead_stock_alert
}