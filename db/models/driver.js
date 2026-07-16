'use strict'
module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define(
    'driver',
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
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      phone: {
        type: DataTypes.STRING
      },
      email: {
        type: DataTypes.STRING
      },
      vehicleType: {
        type: DataTypes.STRING
      },
      vehiclePlate: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      currentLat: {
        type: DataTypes.DECIMAL(10, 7)
      },
      currentLng: {
        type: DataTypes.DECIMAL(10, 7)
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
      modelName: 'driver',
      tableName: 'driver'
    }
  )

  Driver.associate = (models) => {
    Driver.hasMany(models.delivery_order, { foreignKey: 'driverId', as: 'deliveries' })
  }

  return Driver
}
