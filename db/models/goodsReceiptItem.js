'use strict'
module.exports = (sequelize, DataTypes) => {
  const goodsReceiptItem = sequelize.define(
    'goodsReceiptItem',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      goodsReceipt: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      purchaseOrderItem: {
        type: DataTypes.INTEGER
      },
      product: {
        type: DataTypes.INTEGER
      },
      qtyReceived: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      costPrice: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Actual received unit cost (HPP) - editable for price variance'
      },
      landedCost: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Allocated landed cost per unit from PO additionalCost'
      },
      conversionToBase: {
        type: DataTypes.DECIMAL(10, 4),
        defaultValue: 1,
        comment: 'Factor to convert received unit to base stock unit'
      },
      qtyStock: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
        comment: 'Received quantity expressed in base stock unit'
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: 'pcs'
      },
      conditionNotes: {
        type: DataTypes.TEXT
      },
      ingredientName: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'goodsReceiptItem',
      tableName: 'goods_receipt_item'
    }
  )

  goodsReceiptItem.associate = (models) => {
    goodsReceiptItem.belongsTo(models.goodsReceipt, {
      foreignKey: 'goodsReceipt',
      as: 'receipt'
    })
    goodsReceiptItem.belongsTo(models.purchase_order_item, {
      foreignKey: 'purchaseOrderItem',
      as: 'poItemData'
    })
    goodsReceiptItem.belongsTo(models.product, {
      foreignKey: 'product',
      as: 'productData'
    })
  }

  return goodsReceiptItem
}
