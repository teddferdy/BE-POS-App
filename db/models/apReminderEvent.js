'use strict'
module.exports = (sequelize, DataTypes) => {
  const apReminderEvent = sequelize.define(
    'ap_reminder_event',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      purchaseOrder: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      classification: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      businessDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      notificationId: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      freezeTableName: true,
      modelName: 'ap_reminder_event',
      tableName: 'ap_reminder_event'
    }
  )

  apReminderEvent.associate = (models) => {
    apReminderEvent.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    apReminderEvent.belongsTo(models.purchase_order, {
      foreignKey: 'purchaseOrder',
      as: 'purchaseOrderData'
    })
    apReminderEvent.belongsTo(models.notification, {
      foreignKey: 'notificationId',
      as: 'notificationData'
    })
  }

  return apReminderEvent
}
