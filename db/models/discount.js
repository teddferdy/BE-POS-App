'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'discount',
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
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      type: {
        allowNull: false,
        type: DataTypes.ENUM('percent', 'nominal'),
        defaultValue: 'percent'
      },
      value: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      minimumOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      maximumDiscount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      startDate: {
        type: DataTypes.DATE
      },
      endDate: {
        type: DataTypes.DATE
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      createdBy: {
        type: DataTypes.STRING
      },
      modifiedBy: {
        type: DataTypes.STRING
      },
      code: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true
      },
      conditions: {
        type: DataTypes.JSONB,
        defaultValue: null
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'discount',
      tableName: 'discount'
    }
  )
}
