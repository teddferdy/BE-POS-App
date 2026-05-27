'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'member_tier',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      minPoints: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      maxPoints: {
        type: DataTypes.INTEGER,
        defaultValue: 999999
      },
      discountPercent: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      pointMultiplier: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 1.0
      },
      benefits: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      color: {
        type: DataTypes.STRING,
        defaultValue: '#000000'
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
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
      modelName: 'member_tier',
      tableName: 'member_tier'
    }
  )
}
