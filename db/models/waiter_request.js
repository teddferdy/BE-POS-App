'use strict'
module.exports = (sequelize, DataTypes) => {
  const WaiterRequest = sequelize.define(
    'waiter_request',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.JSONB
      },
      requestNumber: {
        allowNull: false,
        type: DataTypes.STRING(20)
      },
      tableId: {
        type: DataTypes.INTEGER
      },
      orderId: {
        type: DataTypes.INTEGER
      },
      type: {
        type: DataTypes.ENUM('sendok', 'tisu', 'refill', 'bill', 'call'),
        allowNull: false
      },
      notes: {
        type: DataTypes.TEXT
      },
      customerName: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'done'),
        defaultValue: 'pending'
      },
      resolvedAt: {
        type: DataTypes.DATE
      },
      resolvedBy: {
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
      modelName: 'waiter_request',
      tableName: 'waiter_request'
    }
  )

  WaiterRequest.associate = function (models) {
    WaiterRequest.belongsTo(models.table, {
      foreignKey: 'tableId',
      as: 'table'
    })
    WaiterRequest.belongsTo(models.order, {
      foreignKey: 'orderId',
      as: 'order'
    })
    WaiterRequest.belongsTo(models.user, {
      foreignKey: 'resolvedBy',
      as: 'resolvedByUser'
    })
  }

  return WaiterRequest
}
