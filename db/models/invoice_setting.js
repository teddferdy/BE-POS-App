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
      showStoreName: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      showAddress: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      showMemberInfo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      showLogo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      showSocialMedia: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      socialMediaVisibility: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
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
      modelName: 'invoice_setting',
      tableName: 'invoice_setting'
    }
  )
}
