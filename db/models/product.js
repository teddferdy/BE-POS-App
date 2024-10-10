'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'product',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    nameProduct: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.STRING
    },
    image: {
      type: DataTypes.STRING
    },
    category: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.STRING
    },
    description: {
      type: DataTypes.STRING
    },
    price: {
      type: DataTypes.STRING
    },
    option: {
      primaryKey: true,
      type: DataTypes.ARRAY(DataTypes.INTEGER)
    },
    status: {
      primaryKey: true,
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
    modelName: 'product'
  }
)
