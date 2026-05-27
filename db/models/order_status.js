'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'order_status',
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
      status: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.TEXT
      },
      createdBy: {
        type: DataTypes.INTEGER
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'order_status',
      tableName: 'order_status'
    }
  )
}
