'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'reservation',
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
      tableId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      customerName: {
        allowNull: false,
        type: DataTypes.STRING
      },
      customerPhone: {
        type: DataTypes.STRING
      },
      customerEmail: {
        type: DataTypes.STRING,
        allowNull: true
      },
      guestCount: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      reservationDate: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      startTime: {
        allowNull: false,
        type: DataTypes.TIME
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT
      },
      status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show'),
        defaultValue: 'pending'
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
      modelName: 'reservation',
      tableName: 'reservation'
    }
  )
}
