'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'daily_summary',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      totalRevenue: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalCost: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      grossProfit: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalExpenses: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      netProfit: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalOrders: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalItemsSold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      paymentBreakdown: {
        type: DataTypes.JSONB,
        defaultValue: {}
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'daily_summary',
      tableName: 'daily_summary',
      indexes: [
        {
          unique: true,
          fields: ['store', 'date']
        }
      ]
    }
  )
}
