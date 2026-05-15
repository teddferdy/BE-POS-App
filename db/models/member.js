'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'member',
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
      phoneNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      email: {
        type: DataTypes.STRING
      },
      address: {
        type: DataTypes.STRING
      },
      tier: {
        type: DataTypes.INTEGER
      },
      totalPoints: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      lifetimePoints: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY
      },
      gender: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.TEXT
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
      modelName: 'member',
      tableName: 'member'
    }
  )
}