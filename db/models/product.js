'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'product',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER
      },
      nameProduct: {
        allowNull: false,
        type: DataTypes.STRING
      },
      image: {
        type: DataTypes.STRING
      },

      category: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      subCategory: {
        type: DataTypes.INTEGER
      },
      description: {
        type: DataTypes.TEXT
      },
      price: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      costPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      isOption: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      options: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      hasModifiers: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      modifiers: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      minStock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      isAvailable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      preparationTime: {
        type: DataTypes.INTEGER,
        defaultValue: 15
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      modifiedBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'product',
      tableName: 'product'
    }
  )
}
