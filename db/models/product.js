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
      type: DataTypes.STRING,
      primaryKey: true
    },
    image: {
      allowNull: false,
      type: DataTypes.STRING
    },
    imageName: {
      type: DataTypes.STRING
    },
    category: {
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    description: {
      type: DataTypes.STRING
    },
    price: {
      type: DataTypes.STRING
    },
    isOption: {
      allowNull: false,
      type: DataTypes.BOOLEAN
    },
    option: {
      allowNull: true,
      defaultValue: [],
      type: DataTypes.ARRAY(DataTypes.INTEGER)
    },
    status: {
      primaryKey: true,
      type: DataTypes.BOOLEAN
    },
    store: {
      allowNull: false,
      type: DataTypes.INTEGER,
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
    modelName: 'product'
  }
)
