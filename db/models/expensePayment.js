'use strict'
module.exports = (sequelize, DataTypes) => {
  const expensePayment = sequelize.define(
    'expense_payment',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      expenseId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: { type: DataTypes.INTEGER },
      amount: { type: DataTypes.INTEGER, defaultValue: 0 },
      paymentDate: { type: DataTypes.DATE },
      paymentMethod: { type: DataTypes.STRING },
      note: { type: DataTypes.TEXT },
      createdBy: { type: DataTypes.INTEGER }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'expense_payment',
      tableName: 'expense_payment'
    }
  )

  expensePayment.associate = (models) => {
    expensePayment.belongsTo(models.expense, {
      foreignKey: 'expenseId',
      as: 'expenseData'
    })
    expensePayment.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    expensePayment.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'createdByUser'
    })
  }

  return expensePayment
}
