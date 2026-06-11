'use strict'
module.exports = (sequelize, DataTypes) => {
  const goodsReceipt = sequelize.define(
    'goodsReceipt',
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
      receiptNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      purchaseOrderId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      receivedDate: {
        type: DataTypes.DATE
      },
      status: {
        type: DataTypes.ENUM('draft', 'completed', 'cancelled'),
        defaultValue: 'draft'
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
      modelName: 'goodsReceipt',
      tableName: 'goods_receipt'
    }
  )

  goodsReceipt.associate = (models) => {
    goodsReceipt.hasMany(models.goodsReceiptItem, {
      foreignKey: 'goodsReceipt',
      as: 'items'
    })
    goodsReceipt.belongsTo(models.purchase_order, {
      foreignKey: 'purchaseOrderId',
      as: 'purchaseOrderData'
    })
    goodsReceipt.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return goodsReceipt
}
