'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'order_item',
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
      product: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      productName: {
        type: DataTypes.STRING
      },
      quantity: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      price: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      discountType: {
        type: DataTypes.ENUM('none', 'percent', 'nominal'),
        defaultValue: 'none'
      },
      discountValue: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      discountAmount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      options: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      modifiers: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      notes: {
        type: DataTypes.TEXT
      },
      status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'served'),
        defaultValue: 'pending'
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      waktuSiap: {
        type: DataTypes.DATE,
        allowNull: true
      },
      urutanSaji: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      hppSnapshot: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
      },
      stationDapur: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'order_item',
      tableName: 'order_item'
    }
  )
}
