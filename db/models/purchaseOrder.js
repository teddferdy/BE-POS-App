'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'purchase_order',
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
      orderNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      supplier: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      totalAmount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      discount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      finalAmount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM('pending', 'ordered', 'received', 'cancelled'),
        defaultValue: 'pending'
      },
      orderDate: {
        type: DataTypes.DATE
      },
      receivedDate: {
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
      modelName: 'purchase_order',
      tableName: 'purchase_order'
    }
  )
}