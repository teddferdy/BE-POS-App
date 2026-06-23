'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'ingredientCategory',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.JSON
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
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
      modelName: 'ingredientCategory',
      tableName: 'ingredient_category'
    }
  )
}
