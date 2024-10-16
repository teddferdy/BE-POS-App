'use strict'
const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')
const Category = require('./category')

const SubCategory = sequelize.define(
  'sub_category',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    idParentCategory: {
      primaryKey: true,
      type: DataTypes.INTEGER
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
    modelName: 'sub_category'
  }
)

// Define the relationship between Category and SubCategory
Category.hasMany(SubCategory, {
  foreignKey: 'idParentCategory',
  sourceKey: 'name', // `name` is the key used for the relationship
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
})

SubCategory.belongsTo(Category, {
  foreignKey: 'idParentCategory',
  targetKey: 'name'
})

// Export the SubCategory model
module.exports = SubCategory
