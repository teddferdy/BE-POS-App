'use strict'
module.exports = (sequelize, DataTypes) => {
  const DeliveryOrder = sequelize.define(
    'delivery_order',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      orderNumber: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true
      },
      order: {
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      driverId: {
        type: DataTypes.INTEGER
      },
      driverName: {
        type: DataTypes.STRING
      },
      customerName: {
        type: DataTypes.STRING
      },
      customerPhone: {
        type: DataTypes.STRING
      },
      deliveryAddress: {
        type: DataTypes.TEXT
      },
      deliveryNotes: {
        type: DataTypes.TEXT
      },
      destinationLat: {
        type: DataTypes.DECIMAL(10, 7)
      },
      destinationLng: {
        type: DataTypes.DECIMAL(10, 7)
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
      },
      estimatedDeliveryTime: {
        type: DataTypes.DATE
      },
      actualDeliveryTime: {
        type: DataTypes.DATE
      },
      deliveryFee: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      totalDistance: {
        type: DataTypes.DECIMAL(8, 2)
      },
      source: {
        type: DataTypes.STRING(20),
        defaultValue: 'pos'
      },
      cancellationReason: {
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
      modelName: 'delivery_order',
      tableName: 'delivery_order'
    }
  )

  DeliveryOrder.associate = (models) => {
    DeliveryOrder.belongsTo(models.order, { foreignKey: 'order', as: 'orderData' })
    DeliveryOrder.belongsTo(models.driver, { foreignKey: 'driverId', as: 'driver' })
    DeliveryOrder.belongsTo(models.location, { foreignKey: 'store', as: 'storeData' })
    DeliveryOrder.hasMany(models.delivery_status_history, { foreignKey: 'deliveryOrder', as: 'statusHistory' })
  }

  return DeliveryOrder
}
