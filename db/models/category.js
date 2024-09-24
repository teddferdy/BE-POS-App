'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'category',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    name: {
      allowNull: false,
      type: DataTypes.STRING,
      primaryKey: true
    },
    value: {
      type: DataTypes.STRING
    },
    status: {
      primaryKey: true,
      type: DataTypes.BOOLEAN
    },
    createdBy: {
      allowNull: false,
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
    modifiedAt: {
      type: DataTypes.STRING
    },
    deletedAt: {
      type: DataTypes.STRING
    }
  },
  {
    paranoid: true,
    freezeTableName: true,
    modelName: 'category'
  }
)
