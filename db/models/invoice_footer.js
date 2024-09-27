'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'invoice_footer',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    name: {
      type: DataTypes.STRING
    },
    footerList: {
      type: DataTypes.TEXT
    },
    status: {
      type: DataTypes.BOOLEAN
    },
    isActive: {
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
    modelName: 'invoice_footer'
  }
)
