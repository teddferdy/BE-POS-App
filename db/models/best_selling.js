'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
module.exports = sequelize.define(
  'best_selling',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    store: {
      allowNull: false,
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    productId: {
      primaryKey: true,
      type: DataTypes.BIGINT
    },
    nameProduct: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.STRING
    },
    image: {
      type: DataTypes.STRING
    },
    totalSelling: {
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
    modelName: 'best_selling'
  }
)
