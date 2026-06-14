'use strict'
module.exports = (sequelize, DataTypes) => {
  const accountsReceivable = sequelize.define(
    'accounts_receivable',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: { type: DataTypes.INTEGER },
      orderId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      customerId: { type: DataTypes.INTEGER },
      customerName: { type: DataTypes.STRING },
      invoiceNo: { type: DataTypes.STRING },
      invoiceDate: { type: DataTypes.DATEONLY },
      dueDate: { type: DataTypes.DATEONLY },
      creditTerm: { type: DataTypes.STRING },
      totalAmount: { type: DataTypes.INTEGER, defaultValue: 0 },
      paidAmount: { type: DataTypes.INTEGER, defaultValue: 0 },
      outstandingAmount: { type: DataTypes.INTEGER, defaultValue: 0 },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'UNPAID'
      },
      notes: { type: DataTypes.TEXT },
      createdBy: { type: DataTypes.INTEGER },
      modifiedBy: { type: DataTypes.INTEGER }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'accounts_receivable',
      tableName: 'accounts_receivable'
    }
  )

  accountsReceivable.associate = (models) => {
    accountsReceivable.belongsTo(models.order, {
      foreignKey: 'orderId',
      as: 'orderData'
    })
    accountsReceivable.hasMany(models.ar_payment, {
      foreignKey: 'arId',
      as: 'payments'
    })
  }

  return accountsReceivable
}
