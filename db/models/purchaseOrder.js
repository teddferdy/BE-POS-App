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
        type: DataTypes.ENUM(
          'draft',
          'pending',
          'ordered',
          'received',
          'cancelled'
        ),
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
      },
      paymentMethod: {
        type: DataTypes.ENUM('cash', 'credit'),
        defaultValue: 'cash'
      },
      tenor: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of days for credit payment (e.g. 7, 14, 30)'
      },
      dpPercent: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Down payment percentage (0-100)'
      },
      additionalCost: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Landed cost / freight / additional cost allocated to HPP'
      },
      overDeliveryTolerance: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
        comment: 'Allowed over-delivery tolerance in percent of ordered qty'
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
    purchaseOrder.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'createdByUser'
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
