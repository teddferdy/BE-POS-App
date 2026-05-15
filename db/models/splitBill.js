'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'split_bill',
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
      splitNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      amount: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      status: {
        type: DataTypes.ENUM('pending', 'paid'),
        defaultValue: 'pending'
      },
      paymentMethod: {
        type: DataTypes.STRING
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'split_bill',
      tableName: 'split_bill'
    }
  )
}