'use strict'
module.exports = (sequelize, DataTypes) => {
  const purchasePayment = sequelize.define(
    'purchase_payment',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: { type: DataTypes.INTEGER },
      purchaseOrder: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      supplier: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      paymentDate: { type: DataTypes.DATEONLY },
      amount: { type: DataTypes.INTEGER, defaultValue: 0 },
      paymentMethod: { type: DataTypes.STRING },
      reference: { type: DataTypes.STRING },
      notes: { type: DataTypes.TEXT },
      createdBy: { type: DataTypes.INTEGER }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'purchase_payment',
      tableName: 'purchase_payment'
    }
  )

  purchasePayment.associate = (models) => {
    purchasePayment.belongsTo(models.purchase_order, {
      foreignKey: 'purchaseOrder',
      as: 'purchaseOrderData'
    })
    purchasePayment.belongsTo(models.supplier, {
      foreignKey: 'supplier',
      as: 'supplierData'
    })
    purchasePayment.belongsTo(models.user, {
      foreignKey: 'createdBy',
      as: 'createdByUser'
    })
  }

  return purchasePayment
}
