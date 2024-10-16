'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'location',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    image: {
      primaryKey: true,
      type: DataTypes.STRING
    },
    imageName: {
      type: DataTypes.STRING
    },
    nameStore: {
      type: DataTypes.STRING,
      primaryKey: true
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
      primaryKey: true
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
    modelName: 'location'
  }
)
