'use strict'
module.exports = (sequelize, DataTypes) => {
  const expense = sequelize.define(
    'expense',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      expenseNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      category: {
        type: DataTypes.INTEGER
      },
      description: {
        type: DataTypes.TEXT
      },
      amount: {
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
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'draft'),
        defaultValue: 'pending'
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

  expense.associate = (models) => {
    expense.belongsTo(models.expense_category, {
      foreignKey: 'category',
      as: 'categoryData'
    })
    expense.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'creator'
    })
  }

  return expense
}
