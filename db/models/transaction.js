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
    transaction.belongsTo(models.order, { foreignKey: 'order', as: 'orderDetail' })
  }

  return transaction
}
