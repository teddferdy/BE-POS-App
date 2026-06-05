'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'invoice_setting',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      store: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
      },
      logoImage: {
        type: DataTypes.STRING, // URL from Cloudinary
        allowNull: true
      },
      footerText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      socialMediaList: {
        type: DataTypes.TEXT, // JSON string
        allowNull: true
      },
      showLogo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      showStoreName: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      showAddress: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      showFooter: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
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
      modelName: 'invoice_setting',
      tableName: 'invoice_setting'
    }
  )
}