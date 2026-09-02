'use strict'
module.exports = (sequelize, DataTypes) => {
  const businessTrip = sequelize.define(
    'businessTrip',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      tripNumber: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true
      },
      store: {
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
      },
      destination: {
        type: DataTypes.STRING
      },
      tripPurpose: {
        type: DataTypes.TEXT
      },
      departureDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      returnDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      budget: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT
      },
      status: {
        type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
        defaultValue: 'draft'
      },
      approvedBy: {
        type: DataTypes.INTEGER
      },
      approvedAt: {
        type: DataTypes.DATE
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
      modelName: 'businessTrip',
      tableName: 'business_trip'
    }
  )

  businessTrip.associate = (models) => {
    businessTrip.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    businessTrip.belongsTo(models.user, {
      foreignKey: 'employeeId',
      as: 'employeeUser'
    })
    businessTrip.belongsTo(models.user, {
      foreignKey: 'approvedBy',
      as: 'approvedByUser'
    })
    businessTrip.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'createdByUser'
    })
  }

  return businessTrip
}
