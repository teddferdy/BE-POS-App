'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'expense',
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
      expenseNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      category: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      description: {
        type: DataTypes.TEXT
      },
      amount: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      date: {
        allowNull: false,
        type: DataTypes.DATE
      },
      paymentMethod: {
        type: DataTypes.ENUM('cash', 'bank', 'e-wallet'),
        defaultValue: 'cash'
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'approved'
      },
      notes: {
        type: DataTypes.TEXT
      },
      receipt: {
        type: DataTypes.STRING
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
      modelName: 'expense',
      tableName: 'expense'
    }
  )
}