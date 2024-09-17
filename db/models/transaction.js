'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'transaction',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    masterId: {
      type: DataTypes.INTEGER
    },
    productId: {
      type: DataTypes.INTEGER
    },
    quantityPerProduct: {
      type: DataTypes.INTEGER
    },
    productName: {
      type: DataTypes.STRING
    },
    price: {
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
    modelName: 'transaction'
  }
)
