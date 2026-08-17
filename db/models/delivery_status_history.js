'use strict'
module.exports = (sequelize, DataTypes) => {
  const DeliveryStatusHistory = sequelize.define(
    'delivery_status_history',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      deliveryOrder: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING(20)
      },
      notes: {
        type: DataTypes.TEXT
      },
      changedBy: {
        type: DataTypes.INTEGER
      },
      changedByName: {
        type: DataTypes.STRING
      },
      locationLat: {
        type: DataTypes.DECIMAL(10, 7)
      },
      locationLng: {
        type: DataTypes.DECIMAL(10, 7)
      }
    },
    {
      freezeTableName: true,
      modelName: 'delivery_status_history',
      tableName: 'delivery_status_history'
    }
  )

  DeliveryStatusHistory.associate = (models) => {
    DeliveryStatusHistory.belongsTo(models.delivery_order, {
      foreignKey: 'deliveryOrder',
      as: 'deliveryOrderData'
    })
  }

  return DeliveryStatusHistory
}
