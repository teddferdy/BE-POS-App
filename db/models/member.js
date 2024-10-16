'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'member',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    nameMember: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    phoneNumber: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    store: {
      allowNull: false,
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    status: {
      type: DataTypes.BOOLEAN
    },
    point: {
      type: DataTypes.BIGINT
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
    modelName: 'member'
  }
)
