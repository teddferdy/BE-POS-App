'use strict'
module.exports = (sequelize, DataTypes) => {
  const kasir_performance = sequelize.define(
    'kasir_performance',
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
      cashier: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      report_date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      total_sales: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      transactions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      avg_transaction: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      items_sold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      accuracy_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      }
    },
    {
      freezeTableName: true,
      modelName: 'kasir_performance',
      tableName: 'kasir_performance',
      indexes: [
        { fields: ['store', 'cashier', 'report_date'] },
        { fields: ['report_date'] }
      ]
    }
  )

  kasir_performance.associate = (models) => {
    kasir_performance.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    kasir_performance.belongsTo(models.user, {
      foreignKey: 'cashier',
      as: 'cashierData'
    })
  }

  return kasir_performance
}
