'use strict'
module.exports = (sequelize, DataTypes) => {
  const purchaseOrderItem = sequelize.define(
    'purchase_order_item',
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
      product: {
        type: DataTypes.INTEGER
      },
      ingredientName: {
        type: DataTypes.STRING
      },
      ingredient: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      supplier: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      total: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      receivedQuantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      conversionToBase: {
        type: DataTypes.DECIMAL(10, 4),
        defaultValue: 1,
        comment: 'Factor to convert PO unit to base unit (stock unit) of the item'
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'purchase_order_item',
      tableName: 'purchase_order_item'
    }
  )

  purchaseOrderItem.associate = (models) => {
    purchaseOrderItem.belongsTo(models.purchase_order, {
      foreignKey: 'purchaseOrder',
      as: 'purchaseOrderData'
    })
    purchaseOrderItem.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
    purchaseOrderItem.belongsTo(models.ingredient, {
      foreignKey: 'ingredient',
      as: 'ingredientData'
    })
    purchaseOrderItem.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
  }

  return purchaseOrderItem
}
