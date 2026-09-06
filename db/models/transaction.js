'use strict'
module.exports = (sequelize, DataTypes) => {
  const transaction = sequelize.define(
    'transaction',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      order: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      typePayment: {
        allowNull: false,
        type: DataTypes.STRING
      },
      amount: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      cardNumber: {
        type: DataTypes.STRING
      },
      cardType: {
        type: DataTypes.STRING
      },
      referenceNumber: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      salesReturnId: {
        type: DataTypes.INTEGER
      },
      // Cash tender only. Net cash retained in the drawer for this row is
      // (cashReceived - changeGiven) — NOT cashReceived alone. Null for
      // non-cash tenders. See cashRegister.cashSalesReceived for the
      // aggregate formula that consumes these two fields.
      cashReceived: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      changeGiven: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'transaction',
      tableName: 'transaction'
    }
  )

  transaction.associate = (models) => {
    transaction.belongsTo(models.order, {
      foreignKey: 'order',
      as: 'orderDetail'
    })
    transaction.belongsTo(models.sales_return, {
      foreignKey: 'salesReturnId',
      as: 'salesReturn'
    })
  }

  return transaction
}
