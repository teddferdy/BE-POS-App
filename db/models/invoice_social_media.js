'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'invoice_social_media',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    name: {
      primaryKey: true,
      type: DataTypes.STRING
    },
    socialMediaList: {
      type: DataTypes.TEXT
    },
    status: {
      primaryKey: true,
      type: DataTypes.BOOLEAN
    },
    store: {
      primaryKey: true,
      type: DataTypes.STRING
    },
    isActive: {
      primaryKey: true,
      type: DataTypes.BOOLEAN
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
    modelName: 'invoice_social_media'
  }
)
