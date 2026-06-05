'use strict'
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'location',
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
      image: {
        type: DataTypes.STRING
      },
      name: {
        type: DataTypes.STRING
      },
      address: {
        type: DataTypes.STRING
      },
      detailLocation: {
        type: DataTypes.STRING
      },
      city: {
        type: DataTypes.STRING
      },
      province: {
        type: DataTypes.STRING
      },
      district: {
        type: DataTypes.STRING
      },
      village: {
        type: DataTypes.STRING
      },
      postalCode: {
        type: DataTypes.STRING
      },
      latitude: {
        type: DataTypes.FLOAT
      },
      longitude: {
        type: DataTypes.FLOAT
      },
      mainBranch: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      description: {
        type: DataTypes.TEXT
      },
      openingHours: {
        type: DataTypes.JSONB
      },
      managerName: {
        type: DataTypes.STRING
      },
      email: {
        type: DataTypes.STRING
      },
      category: {
        type: DataTypes.STRING
      },
      phoneNumber: {
        type: DataTypes.STRING
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
      },
      socialMedia: {
        type: DataTypes.JSONB
      }
    },
    {
      paranoid: true,
      freezeTableName: true,
      modelName: 'location',
      tableName: 'location'
    }
  )
}
