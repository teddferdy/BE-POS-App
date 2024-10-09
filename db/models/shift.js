'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'shift',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    nameShift: {
      primaryKey: true,
      type: DataTypes.STRING
    },
    description: {
      primaryKey: true,
      type: DataTypes.STRING
    },
    startHour: {
      primaryKey: true,
      type: DataTypes.TIME
    },
    endHour: {
      primaryKey: true,
      type: DataTypes.TIME
    },
    status: {
      type: DataTypes.BOOLEAN
    },
    store: {
      primaryKey: true,
      type: DataTypes.STRING
    },
    createdBy: {
      type: DataTypes.STRING
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    modifiedBy: {
      type: DataTypes.STRING
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    deletedAt: {
      type: DataTypes.STRING
    }
  },
  {
    paranoid: true,
    freezeTableName: true,
    modelName: 'shift'
  }
)
