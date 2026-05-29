'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'category',
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
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      value: {
        type: DataTypes.STRING
      },
      image: {
        type: DataTypes.STRING
      },

      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      createdBy: {
        type: DataTypes.STRING
      },
      modifiedBy: {
        type: DataTypes.STRING
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'category',
      tableName: 'category'
    }
  )
}
