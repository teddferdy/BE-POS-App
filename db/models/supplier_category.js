'use strict'
module.exports = (sequelize, DataTypes) => {
  const supplier_category = sequelize.define(
    'supplier_category',
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
      description: {
        type: DataTypes.TEXT
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
      modelName: 'supplier_category',
      tableName: 'supplier_category'
    }
  )

  supplier_category.associate = (models) => {
    supplier_category.hasMany(models.supplier, {
      foreignKey: 'categoryId',
      as: 'suppliers'
    })
  }

  return supplier_category
}
