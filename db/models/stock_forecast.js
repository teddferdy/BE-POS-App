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
      forecasted_stockout_date: {
        allowNull: true,
        type: DataTypes.DATEONLY
      },
      days_until_stockout: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      daily_consumption_rate: {
        allowNull: true,
        type: DataTypes.DECIMAL(10, 4)
      },
      confidence_level: {
        allowNull: true,
        type: DataTypes.DECIMAL(5, 2)
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