'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'table',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      capacity: {
        type: DataTypes.INTEGER,
        defaultValue: 4
      },
      status: {
        type: DataTypes.ENUM(
          'available',
          'occupied',
          'reserved',
          'maintenance'
        ),
        defaultValue: 'available'
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
      modelName: 'table',
      tableName: 'table'
    }
  )
}
