'use strict'
module.exports = (sequelize, DataTypes) => {
  const goodsRequest = sequelize.define(
    'goodsRequest',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      requestNumber: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true
      },
      store: {
        type: DataTypes.INTEGER
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        defaultValue: 'pending'
      },
      requestedBy: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.TEXT
      },
      approvedBy: {
        type: DataTypes.INTEGER
      },
      approvedAt: {
        type: DataTypes.DATE
      },
      purchaseOrderId: {
        type: DataTypes.INTEGER
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
      modelName: 'goodsRequest',
      tableName: 'goods_request'
    }
  )

  goodsRequest.associate = (models) => {
    goodsRequest.hasMany(models.goodsRequestItem, {
      foreignKey: 'goodsRequest',
      as: 'items'
    })
    goodsRequest.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    goodsRequest.belongsTo(models.purchase_order, {
      foreignKey: 'purchaseOrderId',
      as: 'purchaseOrderData'
    })
    goodsRequest.belongsTo(models.user, {
      foreignKey: 'approvedBy',
      as: 'approvedByUser'
    })
    goodsRequest.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'createdByUser'
    })
  }

  return goodsRequest
}
