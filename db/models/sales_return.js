'use strict'
module.exports = (sequelize, DataTypes) => {
  const sales_return = sequelize.define(
    'sales_return',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      order: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      returnNumber: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      reason: {
        type: DataTypes.TEXT
      },
      returnedBy: {
        type: DataTypes.STRING
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'sales_return',
      tableName: 'sales_return'
    }
  )

  sales_return.associate = (models) => {
    sales_return.hasMany(models.sales_return_item, {
      foreignKey: 'salesReturn',
      as: 'items'
    })
    sales_return.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    sales_return.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'returnedByData'
    })
  }

  return sales_return
}
