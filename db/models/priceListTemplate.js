'use strict'
module.exports = (sequelize, DataTypes) => {
  const priceListTemplate = sequelize.define(
    'priceListTemplate',
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
      description: {
        type: DataTypes.TEXT
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      tiers: {
        type: DataTypes.JSONB,
        defaultValue: []
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
      modelName: 'priceListTemplate',
      tableName: 'price_list_template'
    }
  )

  return priceListTemplate
}
