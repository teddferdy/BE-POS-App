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
    modelName: 'best_selling'
  }
)
