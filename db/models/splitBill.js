'use strict'
module.exports = (sequelize, DataTypes) => {
  const split_bill = sequelize.define(
    'split_bill',
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
      splitNumber: {
        allowNull: false,
        type: DataTypes.STRING
      },
      amount: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      status: {
        type: DataTypes.ENUM('pending', 'paid'),
        allowNull: false,
        defaultValue: 'pending'
      },
      paymentMethod: {
        type: DataTypes.STRING
      },
      createdBy: {
        type: DataTypes.INTEGER
      },
      // Create-retry idempotency key, scoped (order, idempotencyKey) via a
      // plain lookup index (not a unique constraint — see the migration
      // for why: one key legitimately covers multiple rows here, and
      // create()'s order-row lock already serializes concurrent replays).
      idempotencyKey: {
        type: DataTypes.STRING,
        allowNull: true
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'split_bill',
      tableName: 'split_bill'
    }
  )

  split_bill.associate = (models) => {
    split_bill.belongsTo(models.order, {
      foreignKey: 'order',
      as: 'orderData'
    })
  }

  return split_bill
}
