'use strict'
module.exports = (sequelize, DataTypes) => {
  const accountingOutbox = sequelize.define(
    'accounting_outbox',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      jobType: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      store: {
        type: DataTypes.INTEGER
      },
      referenceType: {
        type: DataTypes.STRING(50)
      },
      referenceId: {
        type: DataTypes.INTEGER
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastError: {
        type: DataTypes.TEXT
      },
      postedAt: {
        type: DataTypes.DATE
      }
    },
    {
      freezeTableName: true,
      modelName: 'accounting_outbox',
      tableName: 'accounting_outbox'
    }
  )

  return accountingOutbox
}
