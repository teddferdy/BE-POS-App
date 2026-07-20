'use strict'
module.exports = (sequelize, DataTypes) => {
  const purchaseOrder = sequelize.define(
    'purchase_order',
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
      orderNumber: {
        allowNull: false,
        type: DataTypes.STRING
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
        type: DataTypes.ENUM('draft', 'pending', 'ordered', 'received', 'cancelled'),
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
      },
      pic: {
        type: DataTypes.INTEGER
      },
      dueDate: {
        type: DataTypes.DATEONLY
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'purchase_order',
      tableName: 'purchase_order'
    }
  )

  purchaseOrder.associate = (models) => {
    purchaseOrder.belongsTo(models.user, {
      foreignKey: 'pic',
      as: 'picData'
    })
    purchaseOrder.hasMany(models.purchase_order_item, {
      foreignKey: 'purchaseOrder',
      as: 'items'
    })
    purchaseOrder.hasMany(models.goodsReceipt, {
      foreignKey: 'purchaseOrderId',
      as: 'goodsReceipts'
    })
    purchaseOrder.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    purchaseOrder.hasMany(models.purchase_payment, {
      foreignKey: 'purchaseOrder',
      as: 'payments'
    })
  }

  return purchaseOrder
}
