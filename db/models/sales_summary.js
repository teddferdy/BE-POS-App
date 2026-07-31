'use strict'
module.exports = (sequelize, DataTypes) => {
  const sales_summary = sequelize.define(
    'sales_summary',
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
      report_date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      total_sales: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      total_transactions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      total_items: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      average_transaction: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      total_discount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      total_tax: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      payment_cash: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      payment_card: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'sales_summary',
      tableName: 'sales_summary',
      indexes: [
        { fields: ['store', 'report_date'] },
        { fields: ['report_date'] }
      ]
    }
  )

  sales_summary.associate = (models) => {
    sales_summary.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return sales_summary
}
