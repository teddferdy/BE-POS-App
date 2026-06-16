'use strict'
module.exports = (sequelize, DataTypes) => {
  const taxConfig = sequelize.define(
    'taxConfig',
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
      rate: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      type: {
        type: DataTypes.ENUM('percentage', 'fixed'),
        defaultValue: 'percentage'
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      description: {
        type: DataTypes.TEXT
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
      modelName: 'taxConfig',
      tableName: 'tax_config'
    }
  )

  return taxConfig
}
