'use strict'
module.exports = (sequelize, DataTypes) => {
  const businessTripBudgetItem = sequelize.define(
    'businessTripBudgetItem',
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
      komponen: {
        type: DataTypes.STRING
      },
      qty: {
        type: DataTypes.DECIMAL(15, 2)
      },
      satuan: {
        type: DataTypes.STRING
      },
      tarif: {
        type: DataTypes.DECIMAL(15, 2)
      },
      total: {
        type: DataTypes.DECIMAL(15, 2)
      },
      catatan: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'businessTripBudgetItem',
      tableName: 'business_trip_budget_item'
    }
  )

  businessTripBudgetItem.associate = (models) => {
    businessTripBudgetItem.belongsTo(models.businessTrip, {
      foreignKey: 'tripId',
      as: 'trip'
    })
  }

  return businessTripBudgetItem
}
