'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'sub_category',
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
      category: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      options: {
        type: DataTypes.JSONB,
        defaultValue: []
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
      modelName: 'sub_category',
      tableName: 'sub_category'
    }
  )
}
