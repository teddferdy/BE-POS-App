'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'checkout',
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
      dateOrder: {
        type: DataTypes.DATE
      },
      totalPrice: {
        type: DataTypes.INTEGER
      },
      cashierName: {
        type: DataTypes.STRING
      },
      customerName: {
        type: DataTypes.STRING
      },
      customerPhoneNumber: {
        type: DataTypes.STRING
      },
      totalQuantity: {
        type: DataTypes.BIGINT
      },
      typePayment: {
        type: DataTypes.STRING
      },
      createdBy: {
        type: DataTypes.STRING
      },
      modifiedBy: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'checkout',
      tableName: 'checkout'
    }
  )
}
