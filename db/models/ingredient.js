'use strict'
module.exports = (sequelize, DataTypes) => {
  const Ingredient = sequelize.define(
    'ingredient',
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
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      category: {
        type: DataTypes.INTEGER
      },
      supplier: {
        type: DataTypes.INTEGER
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
      costPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
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
      modelName: 'ingredient',
      tableName: 'ingredient'
    }
  )

  Ingredient.associate = (models) => {
    Ingredient.belongsTo(models.supplier, { as: 'supplierData', foreignKey: 'supplier' })
  }

  return Ingredient
}
