'use strict'
module.exports = (sequelize, DataTypes) => {
  const category_store = sequelize.define(
    'category_store',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      category: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
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
      modelName: 'category_store',
      tableName: 'category_store',
      indexes: [
        {
          unique: true,
          fields: ['category', 'store']
        }
      ]
    }
  )

  category_store.associate = (models) => {
    category_store.belongsTo(models.category, {
      foreignKey: 'category',
      as: 'categoryData'
    })
    category_store.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return category_store
}
