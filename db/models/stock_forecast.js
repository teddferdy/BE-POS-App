'use strict'
module.exports = (sequelize, DataTypes) => {
  const stock_forecast = sequelize.define(
    'stock_forecast',
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
      current_quantity: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      daily_consumption_rate: {
        allowNull: true,
        type: DataTypes.DECIMAL(10, 4)
      },
      lead_time_days: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      safety_stock: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      reorder_point: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      forecasted_stockout_date: {
        allowNull: true,
        type: DataTypes.DATEONLY
      },
      forecast_date: {
        allowNull: true,
        type: DataTypes.DATEONLY
      },
      confidence_level: {
        allowNull: true,
        type: DataTypes.DECIMAL(5, 2)
      },
      notes: {
        allowNull: true,
        type: DataTypes.TEXT
      },
      days_until_stockout: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      last_updated: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'stock_forecast',
      tableName: 'stock_forecast',
      indexes: [
        { fields: ['product', 'store'] },
        { fields: ['forecasted_stockout_date'] },
        { fields: ['days_until_stockout'] }
      ]
    }
  )

  stock_forecast.associate = (models) => {
    stock_forecast.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    stock_forecast.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return stock_forecast
}
