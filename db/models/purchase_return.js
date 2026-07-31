'use strict'
module.exports = (sequelize, DataTypes) => {
  const purchase_return = sequelize.define(
    'purchase_return',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      purchaseOrder: {
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
      resolution: {
        type: DataTypes.STRING,
        allowNull: true
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
      modelName: 'purchase_return',
      tableName: 'purchase_return'
    }
  )

  purchase_return.associate = (models) => {
    purchase_return.hasMany(models.purchase_return_item, {
      foreignKey: 'purchaseReturn',
      as: 'items'
    })
    purchase_return.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
    purchase_return.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'createdByUser'
    })
  }

  return purchase_return
}
