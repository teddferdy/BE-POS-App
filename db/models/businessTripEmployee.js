'use strict'
module.exports = (sequelize, DataTypes) => {
  const businessTripEmployee = sequelize.define(
    'businessTripEmployee',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      tripId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      employeeId: {
        type: DataTypes.INTEGER
      },
      employeeName: {
        type: DataTypes.STRING
      },
      employeePosition: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'businessTripEmployee',
      tableName: 'business_trip_employee'
    }
  )

  businessTripEmployee.associate = (models) => {
    businessTripEmployee.belongsTo(models.businessTrip, {
      foreignKey: 'tripId',
      as: 'trip'
    })
    businessTripEmployee.belongsTo(models.user, {
      foreignKey: 'employeeId',
      as: 'employeeUser'
    })
  }

  return businessTripEmployee
}
