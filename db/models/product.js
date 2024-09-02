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
      type: DataTypes.STRING
    },
    image: {
      type: DataTypes.STRING
    },
    category: {
      type: DataTypes.STRING
    },
    description: {
      type: DataTypes.STRING
    },
    price: {
      type: DataTypes.STRING
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
