'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'sub_category',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    parentCategory: {
      primaryKey: true,
      allowNull: false,
      type: DataTypes.STRING
    },
    nameSubCategory: {
      type: DataTypes.STRING
    },
    typeSubCategory: {
      type: DataTypes.TEXT
    },
    isMultiple: {
      type: DataTypes.BOOLEAN
    },
    store: {
      allowNull: false,
      type: DataTypes.STRING,
      primaryKey: true
    },
    createdBy: {
      type: DataTypes.STRING
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
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
    modelName: 'sub_category'
  }
)
