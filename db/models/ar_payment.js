'use strict'
module.exports = (sequelize, DataTypes) => {
  const arPayment = sequelize.define(
    'ar_payment',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      arId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      amount: { type: DataTypes.INTEGER, defaultValue: 0 },
      paymentDate: { type: DataTypes.DATEONLY },
      paymentMethod: { type: DataTypes.STRING },
      reference: { type: DataTypes.STRING },
      notes: { type: DataTypes.TEXT },
      createdBy: { type: DataTypes.INTEGER }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'ar_payment',
      tableName: 'ar_payment'
    }
  )

  arPayment.associate = (models) => {
    arPayment.belongsTo(models.accounts_receivable, {
      foreignKey: 'arId',
      as: 'arData'
    })
  }

  return arPayment
}
