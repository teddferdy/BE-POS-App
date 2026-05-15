'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'location',
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
      image: {
        type: DataTypes.STRING
      },
      imageName: {
        type: DataTypes.STRING
      },
      nameStore: {
        type: DataTypes.STRING
      },
      address: {
        type: DataTypes.STRING
      },
      detailLocation: {
        type: DataTypes.STRING
      },
      phoneNumber: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      createdBy: {
        type: DataTypes.STRING
      },
      modifiedBy: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'location',
      tableName: 'location'
    }
  )
}