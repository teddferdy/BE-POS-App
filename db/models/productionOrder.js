'use strict'
module.exports = (sequelize, DataTypes) => {
  const productionOrder = sequelize.define(
    'productionOrder',
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
      productionNo: {
        allowNull: false,
        type: DataTypes.STRING
      },
      productItemId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      plannedQty: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      producedQty: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM('draft', 'planned', 'in_progress', 'completed', 'cancelled'),
        defaultValue: 'draft'
      },
      scheduledDate: {
        type: DataTypes.DATEONLY
      },
      completedDate: {
        type: DataTypes.DATE
      },
      notes: {
        type: DataTypes.TEXT
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
      modelName: 'productionOrder',
      tableName: 'production_order'
    }
  )

  productionOrder.associate = (models) => {
    productionOrder.belongsTo(models.product, {
      foreignKey: 'productItemId',
      as: 'productData'
    })
    productionOrder.belongsTo(models.location, {
      foreignKey: 'store',
      as: 'storeData'
    })
  }

  return productionOrder
}
