'use strict'
module.exports = (sequelize, DataTypes) => {
  const category = sequelize.define(
    'category',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      description: {
        type: DataTypes.STRING
      },
      value: {
        type: DataTypes.STRING
      },
      image: {
        type: DataTypes.STRING
      },

      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      createdBy: {
        type: DataTypes.STRING
      },
      modifiedBy: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'category',
      tableName: 'category'
    }
  )

  category.associate = (models) => {
    category.hasMany(models.category_store, {
      foreignKey: 'category',
      as: 'storeAssignments'
    })
  }

  return category
}
