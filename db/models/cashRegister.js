'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'cash_register',
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
      user: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      shift: {
        type: DataTypes.INTEGER
      },
      openingBalance: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      closingBalance: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalSales: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalExpenses: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalPayments: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        defaultValue: 'open'
      },
      openedAt: {
        type: DataTypes.DATE
      },
      closedAt: {
        type: DataTypes.DATE
      },
      notes: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'cash_register',
      tableName: 'cash_register'
    }
  )
}