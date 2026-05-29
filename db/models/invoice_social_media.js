'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'invoice_social_media',
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
      socialMediaList: {
        type: DataTypes.TEXT
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
      modelName: 'invoice_social_media',
      tableName: 'invoice_social_media'
    }
  )
}
