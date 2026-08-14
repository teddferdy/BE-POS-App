'use strict'
module.exports = (sequelize, DataTypes) => {
  const Region = sequelize.define(
    'region',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      code: {
        allowNull: false,
        type: DataTypes.STRING(20)
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING(255)
      },
      level: {
        allowNull: false,
        type: DataTypes.STRING(10)
      },
      parentCode: {
        allowNull: true,
        type: DataTypes.STRING(20)
      },
      postalCode: {
        allowNull: true,
        type: DataTypes.STRING(10)
      },
      latitude: {
        allowNull: true,
        type: DataTypes.FLOAT
      },
      longitude: {
        allowNull: true,
        type: DataTypes.FLOAT
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE
      }
    },
    {
      freezeTableName: true,
      modelName: 'region',
      tableName: 'region'
    }
  )
  return Region
}
